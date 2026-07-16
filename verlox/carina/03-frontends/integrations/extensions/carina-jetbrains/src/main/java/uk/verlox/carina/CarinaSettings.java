package uk.verlox.carina;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.PersistentStateComponent;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.components.State;
import com.intellij.openapi.components.Storage;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

@Service(Service.Level.APP)
@State(name = "CarinaSettings", storages = @Storage("carina.xml"))
public final class CarinaSettings implements PersistentStateComponent<CarinaSettings.State> {

    public static final class State {
        public String serverUrl = "http://localhost:3000";
        public String provider = "";
        public String sessionId = "";
    }

    private State state = new State();

    public static CarinaSettings getInstance() {
        return ApplicationManager.getApplication().getService(CarinaSettings.class);
    }

    @Override
    public @Nullable State getState() {
        return state;
    }

    @Override
    public void loadState(@NotNull State state) {
        this.state = state;
    }

    public String getServerUrl() {
        return state.serverUrl == null || state.serverUrl.isBlank()
            ? "http://localhost:3000"
            : state.serverUrl.trim().replaceAll("/$", "");
    }

    public void setServerUrl(String url) {
        state.serverUrl = url;
    }

    public String getProvider() {
        return state.provider == null ? "" : state.provider.trim();
    }

    public void setProvider(String provider) {
        state.provider = provider;
    }

    public String sessionId(@NotNull Project project) {
        if (state.sessionId != null && !state.sessionId.isBlank()) {
            return state.sessionId.trim();
        }
        String name = project.getName();
        return "ide:jetbrains:" + (name == null || name.isBlank() ? "workspace" : name);
    }
}
