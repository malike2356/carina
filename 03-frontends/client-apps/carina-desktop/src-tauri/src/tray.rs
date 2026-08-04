use serde::Deserialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::thread;
use std::time::Duration;
use tauri::{
    image::Image,
    include_image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatePayload {
    pub session_name: Option<String>,
    pub busy: bool,
    pub error: bool,
}

pub struct TrayController {
    session_name: Mutex<String>,
    is_busy: AtomicBool,
    has_error: AtomicBool,
    idle_icon: Image<'static>,
    busy_icon: Image<'static>,
    animation_on: AtomicBool,
}

impl TrayController {
    pub fn new(idle_icon: Image<'static>, busy_icon: Image<'static>) -> Self {
        Self {
            session_name: Mutex::new(String::from("None")),
            is_busy: AtomicBool::new(false),
            has_error: AtomicBool::new(false),
            idle_icon,
            busy_icon,
            animation_on: AtomicBool::new(false),
        }
    }

    pub fn apply_payload(&self, payload: TrayStatePayload) {
        if let Ok(mut name) = self.session_name.lock() {
            *name = payload
                .session_name
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| String::from("None"));
        }
        self.is_busy.store(payload.busy, Ordering::Relaxed);
        self.has_error.store(payload.error, Ordering::Relaxed);
    }
}

fn build_tray_menu(app: &AppHandle, controller: &TrayController) -> tauri::Result<Menu<tauri::Wry>> {
    let session_name = controller
        .session_name
        .lock()
        .map(|value| value.clone())
        .unwrap_or_else(|_| String::from("None"));
    let is_busy = controller.is_busy.load(Ordering::Relaxed);
    let status = if controller.has_error.load(Ordering::Relaxed) {
        "Status: Error"
    } else if is_busy {
        "Status: Working..."
    } else {
        "Status: Ready"
    };

    let show_item = MenuItem::with_id(app, "show", "Open Carina", true, None::<&str>)?;
    let session_item = MenuItem::with_id(
        app,
        "session",
        format!("Session: {session_name}"),
        false,
        None::<&str>,
    )?;
    let status_item = MenuItem::with_id(app, "status", status, false, None::<&str>)?;
    let new_item = MenuItem::with_id(app, "new_session", "New Session", true, Some("n"))?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, Some(","))?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, Some("q"))?;
    let separator_first = PredefinedMenuItem::separator(app)?;
    let separator_second = PredefinedMenuItem::separator(app)?;
    let separator_third = PredefinedMenuItem::separator(app)?;

    Menu::with_items(
        app,
        &[
            &show_item,
            &separator_first,
            &session_item,
            &status_item,
            &separator_second,
            &new_item,
            &settings_item,
            &separator_third,
            &quit_item,
        ],
    )
}

fn refresh_tray(app: &AppHandle) {
    let Some(controller) = app.try_state::<TrayController>() else {
        return;
    };
    let Some(tray_state) = app.try_state::<Mutex<Option<TrayIcon>>>() else {
        return;
    };

    if let Ok(menu) = build_tray_menu(app, &controller) {
        if let Ok(guard) = tray_state.lock() {
            if let Some(tray) = guard.as_ref() {
                let _ = tray.set_menu(Some(menu));
                let icon = if controller.is_busy.load(Ordering::Relaxed) {
                    controller.busy_icon.clone()
                } else {
                    controller.idle_icon.clone()
                };
                let _ = tray.set_icon(Some(icon));
            }
        }
    }
}

fn start_tray_animation(app: AppHandle) {
    let Some(controller) = app.try_state::<TrayController>() else {
        return;
    };
    if controller.animation_on.swap(true, Ordering::Relaxed) {
        return;
    }

    thread::spawn(move || {
        let mut show_busy = false;
        loop {
            let Some(controller) = app.try_state::<TrayController>() else {
                break;
            };
            if !controller.is_busy.load(Ordering::Relaxed) {
                controller.animation_on.store(false, Ordering::Relaxed);
                refresh_tray(&app);
                break;
            }

            if let Some(tray_state) = app.try_state::<Mutex<Option<TrayIcon>>>() {
                if let Ok(guard) = tray_state.lock() {
                    if let Some(tray) = guard.as_ref() {
                        let icon = if show_busy {
                            controller.busy_icon.clone()
                        } else {
                            controller.idle_icon.clone()
                        };
                        let _ = tray.set_icon(Some(icon));
                    }
                }
            }

            show_busy = !show_busy;
            thread::sleep(Duration::from_millis(500));
        }
    });
}

pub fn handle_tray_state_change(app: &AppHandle, payload: TrayStatePayload) {
    let Some(controller) = app.try_state::<TrayController>() else {
        return;
    };
    let was_busy = controller.is_busy.load(Ordering::Relaxed);
    controller.apply_payload(payload);
    refresh_tray(app);
    let is_busy = controller.is_busy.load(Ordering::Relaxed);
    if is_busy && !was_busy {
        start_tray_animation(app.clone());
    }
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn handle_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "show" => show_main_window(app),
        "new_session" => {
            show_main_window(app);
            let _ = app.emit("deep-link-action", "/new");
        }
        "settings" => {
            show_main_window(app);
            let _ = app.emit("deep-link-action", "/settings");
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let idle_icon: Image<'static> = include_image!("icons/32x32.png");
    let busy_icon: Image<'static> = include_image!("icons/128x128.png");

    let controller = TrayController::new(idle_icon.clone(), busy_icon);
    app.manage(controller);
    app.manage(Mutex::new(None::<TrayIcon>));

    let menu = build_tray_menu(app, app.state::<TrayController>().inner())?;
    let tray = TrayIconBuilder::new()
        .icon(idle_icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_tray_menu(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                handle_tray_menu(tray.app_handle(), "show");
            }
            if let TrayIconEvent::DoubleClick {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    if let Ok(mut guard) = app.state::<Mutex<Option<TrayIcon>>>().inner().lock() {
        *guard = Some(tray);
    }

    Ok(())
}

pub fn register_tray_listeners(app: &AppHandle) {
    let handle = app.clone();
    app.listen("tray-state-change", move |event: tauri::Event| {
        if let Ok(payload) = serde_json::from_str::<TrayStatePayload>(event.payload()) {
            handle_tray_state_change(&handle, payload);
        }
    });
}

pub fn register_global_shortcut(app: &AppHandle) {
    let _ = app.global_shortcut().register("CmdOrCtrl+Shift+C");
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
}

pub async fn check_for_updates(app: AppHandle) {
    use tauri_plugin_updater::UpdaterExt;

    let Ok(updater) = app.updater() else {
        return;
    };
    let Ok(Some(update)) = updater.check().await else {
        return;
    };
    let _ = app.emit(
        "update-available",
        UpdateInfo {
            version: update.version.clone(),
            body: update.body.clone(),
        },
    );
}

pub fn emit_deep_link(app: &AppHandle, url: &str) {
    let _ = app.emit("deep-link", url);
}
