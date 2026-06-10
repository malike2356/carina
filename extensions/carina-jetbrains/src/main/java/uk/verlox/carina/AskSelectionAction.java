package uk.verlox.carina;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowManager;
import org.jetbrains.annotations.NotNull;

public final class AskSelectionAction extends AnAction {

    @Override
    public void update(@NotNull AnActionEvent e) {
        Editor editor = e.getData(CommonDataKeys.EDITOR);
        e.getPresentation().setEnabledAndVisible(editor != null && editor.getSelectionModel().hasSelection());
    }

    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        Editor editor = e.getData(CommonDataKeys.EDITOR);
        if (project == null || editor == null) return;

        String selected = editor.getSelectionModel().getSelectedText();
        if (selected == null || selected.isBlank()) return;

        String lang = editor.getVirtualFile() != null
            ? editor.getVirtualFile().getExtension()
            : "text";

        ToolWindow toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Carina");
        if (toolWindow != null) toolWindow.show();

        CarinaChatPanel panel = CarinaChatService.getInstance(project).getPanel();
        if (panel != null) {
            panel.sendMessage("About this " + lang + " selection:\n```" + lang + "\n" + selected + "\n```");
        }
    }
}
