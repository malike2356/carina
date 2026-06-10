package uk.verlox.carina;

import com.intellij.openapi.components.Service;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

@Service(Service.Level.PROJECT)
public final class CarinaChatService {

    private CarinaChatPanel panel;

    public static CarinaChatService getInstance(@NotNull Project project) {
        return project.getService(CarinaChatService.class);
    }

    public void setPanel(@NotNull CarinaChatPanel panel) {
        this.panel = panel;
    }

    public @Nullable CarinaChatPanel getPanel() {
        return panel;
    }
}
