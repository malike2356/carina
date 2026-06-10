package uk.verlox.carina;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import org.jetbrains.annotations.NotNull;

public final class CheckConnectionAction extends AnAction {

    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null) return;

        CarinaClient client = new CarinaClient(project);
        ApplicationManager.getApplication().executeOnPooledThread(() -> {
            boolean ok = client.health();
            String msg;
            if (ok) {
                try {
                    String providers = client.capabilitiesSummary();
                    msg = "Carina connected.\nProviders: " + providers;
                } catch (Exception ex) {
                    msg = "Carina connected (capabilities unavailable: " + ex.getMessage() + ")";
                }
            } else {
                msg = "Carina unreachable at " + CarinaSettings.getInstance().getServerUrl()
                    + "\nStart with: carina web";
            }
            String finalMsg = msg;
            ApplicationManager.getApplication().invokeLater(() ->
                Messages.showInfoMessage(project, finalMsg, "Carina Connection"));
        });
    }
}
