package uk.verlox.carina;

import com.intellij.openapi.options.Configurable;
import com.intellij.util.ui.JBUI;
import org.jetbrains.annotations.Nls;
import org.jetbrains.annotations.Nullable;

import javax.swing.*;

public final class CarinaConfigurable implements Configurable {

    private JTextField serverUrlField;
    private JTextField providerField;
    private JTextField sessionIdField;

    @Override
    public @Nls(capitalization = Nls.Capitalization.Title) String getDisplayName() {
        return "Carina";
    }

    @Override
    public @Nullable JComponent createComponent() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(JBUI.Borders.empty(8));

        serverUrlField = new JTextField(32);
        providerField = new JTextField(32);
        sessionIdField = new JTextField(32);

        panel.add(labeled("Server URL", serverUrlField));
        panel.add(Box.createVerticalStrut(8));
        panel.add(labeled("Provider override (optional)", providerField));
        panel.add(Box.createVerticalStrut(8));
        panel.add(labeled("Session ID (optional)", sessionIdField));
        panel.add(Box.createVerticalStrut(8));
        panel.add(new JLabel("Default gateway: http://localhost:3000 (carina web)"));

        CarinaSettings settings = CarinaSettings.getInstance();
        serverUrlField.setText(settings.getServerUrl());
        providerField.setText(settings.getProvider());
        sessionIdField.setText(settings.getState() != null ? settings.getState().sessionId : "");

        return panel;
    }

    private JPanel labeled(String label, JComponent field) {
        JPanel row = new JPanel();
        row.setLayout(new BoxLayout(row, BoxLayout.Y_AXIS));
        row.add(new JLabel(label));
        row.add(field);
        return row;
    }

    @Override
    public boolean isModified() {
        return true;
    }

    @Override
    public void apply() {
        CarinaSettings settings = CarinaSettings.getInstance();
        settings.setServerUrl(serverUrlField.getText().trim());
        settings.setProvider(providerField.getText().trim());
        if (settings.getState() != null) {
            settings.getState().sessionId = sessionIdField.getText().trim();
        }
    }
}
