package uk.verlox.carina;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import org.jetbrains.annotations.NotNull;

import java.util.List;

public final class ListToolsAction extends AnAction {

    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null) return;

        CarinaClient client = new CarinaClient(project);
        ApplicationManager.getApplication().executeOnPooledThread(() -> {
            String msg;
            try {
                List<String> tools = client.listTools();
                msg = String.join("\n", tools);
            } catch (Exception ex) {
                msg = "Failed to list tools: " + ex.getMessage();
            }
            String finalMsg = msg;
            ApplicationManager.getApplication().invokeLater(() ->
                Messages.showInfoMessage(project, finalMsg, "Carina Tools"));
        });
    }
}
