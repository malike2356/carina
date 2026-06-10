package uk.verlox.carina;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NotNull;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class CarinaClient {

    private static final Gson GSON = new Gson();
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(8))
        .build();
    private final Project project;

    public CarinaClient(@NotNull Project project) {
        this.project = project;
    }

    private CarinaSettings settings() {
        return CarinaSettings.getInstance();
    }

    public boolean health() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(settings().getServerUrl() + "/api/health"))
                .timeout(Duration.ofSeconds(4))
                .GET()
                .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            return res.statusCode() >= 200 && res.statusCode() < 300;
        } catch (Exception e) {
            return false;
        }
    }

    public String capabilitiesSummary() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(settings().getServerUrl() + "/acp/ide/capabilities"))
            .timeout(Duration.ofSeconds(8))
            .GET()
            .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new IllegalStateException("HTTP " + res.statusCode());
        }
        JsonObject json = GSON.fromJson(res.body(), JsonObject.class);
        JsonArray providers = json.getAsJsonArray("configured_providers");
        List<String> names = new ArrayList<>();
        if (providers != null) {
            for (JsonElement el : providers) names.add(el.getAsString());
        }
        return String.join(", ", names);
    }

    public List<String> listTools() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(settings().getServerUrl() + "/acp/tools"))
            .timeout(Duration.ofSeconds(8))
            .GET()
            .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new IllegalStateException("HTTP " + res.statusCode());
        }
        JsonObject json = GSON.fromJson(res.body(), JsonObject.class);
        JsonArray tools = json.getAsJsonArray("tools");
        List<String> lines = new ArrayList<>();
        if (tools != null) {
            for (JsonElement el : tools) {
                JsonObject t = el.getAsJsonObject();
                lines.add(t.get("name").getAsString() + ": " + t.get("description").getAsString());
            }
        }
        return lines;
    }

    public void chatStream(String prompt, Consumer<String> onChunk, Consumer<String> onError, Runnable onDone)
        throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("prompt", prompt);
        body.addProperty("sessionId", settings().sessionId(project));
        body.addProperty("stream", true);
        body.addProperty("client", "jetbrains");
        String provider = settings().getProvider();
        if (!provider.isBlank()) {
            body.addProperty("provider", provider);
        }

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(settings().getServerUrl() + "/acp/ide/chat"))
            .timeout(Duration.ofMinutes(3))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
            .build();

        HttpResponse<java.io.InputStream> res = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (res.statusCode() >= 400) {
            try (var reader = new BufferedReader(new InputStreamReader(res.body(), StandardCharsets.UTF_8))) {
                onError.accept(reader.readLine() != null ? reader.readLine() : ("HTTP " + res.statusCode()));
            }
            return;
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(res.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                String payload = trimmed.substring(5).trim();
                if (payload.isEmpty()) continue;
                JsonObject event = GSON.fromJson(payload, JsonObject.class);
                String type = event.has("type") ? event.get("type").getAsString() : "";
                if ("text".equals(type) && event.has("content")) {
                    onChunk.accept(event.get("content").getAsString());
                } else if ("error".equals(type)) {
                    onError.accept(event.has("error") ? event.get("error").getAsString() : "stream error");
                    return;
                } else if ("done".equals(type)) {
                    onDone.run();
                    return;
                }
            }
            onDone.run();
        }
    }

    public String chat(String prompt) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("prompt", prompt);
        body.addProperty("sessionId", settings().sessionId(project));
        body.addProperty("stream", false);
        body.addProperty("client", "jetbrains");
        String provider = settings().getProvider();
        if (!provider.isBlank()) {
            body.addProperty("provider", provider);
        }

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(settings().getServerUrl() + "/acp/ide/chat"))
            .timeout(Duration.ofMinutes(3))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
            .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new IllegalStateException(res.body());
        }
        JsonObject json = GSON.fromJson(res.body(), JsonObject.class);
        return json.has("reply") ? json.get("reply").getAsString() : "";
    }
}
