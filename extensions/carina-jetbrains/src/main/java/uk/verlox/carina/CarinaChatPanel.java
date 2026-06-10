package uk.verlox.carina;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.project.Project;
import com.intellij.ui.components.JBScrollPane;
import com.intellij.util.ui.JBUI;
import org.jetbrains.annotations.NotNull;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

public final class CarinaChatPanel extends JPanel {

    private final Project project;
    private final JTextArea logArea = new JTextArea();
    private final JTextArea inputArea = new JTextArea(3, 40);
    private final JLabel statusLabel = new JLabel("Connecting...");
    private final CarinaClient client;

    public CarinaChatPanel(@NotNull Project project) {
        super(new BorderLayout());
        this.project = project;
        this.client = new CarinaClient(project);

        logArea.setEditable(false);
        logArea.setLineWrap(true);
        logArea.setWrapStyleWord(true);
        logArea.setFont(JBUI.Fonts.label());

        inputArea.setLineWrap(true);
        inputArea.setWrapStyleWord(true);
        inputArea.setFont(JBUI.Fonts.label());

        JBScrollPane logScroll = new JBScrollPane(logArea);
        logScroll.setPreferredSize(new Dimension(320, 400));

        JPanel bottom = new JPanel(new BorderLayout());
        bottom.setBorder(JBUI.Borders.empty(8));

        JButton sendButton = new JButton("Send");
        sendButton.addActionListener(e -> sendMessage());

        inputArea.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER && !e.isShiftDown()) {
                    e.consume();
                    sendMessage();
                }
            }
        });

        JPanel inputRow = new JPanel(new BorderLayout(8, 0));
        inputRow.add(new JBScrollPane(inputArea), BorderLayout.CENTER);
        inputRow.add(sendButton, BorderLayout.EAST);

        bottom.add(statusLabel, BorderLayout.NORTH);
        bottom.add(inputRow, BorderLayout.CENTER);

        add(logScroll, BorderLayout.CENTER);
        add(bottom, BorderLayout.SOUTH);

        refreshStatus();
    }

    public void sendMessage(String text) {
        String prompt = text == null ? "" : text.trim();
        if (prompt.isEmpty()) return;

        appendLine("You", prompt);
        inputArea.setText("");
        appendRaw("Carina: ");

        ApplicationManager.getApplication().executeOnPooledThread(() -> {
            StringBuilder reply = new StringBuilder();
            try {
                client.chatStream(
                    prompt,
                    chunk -> ApplicationManager.getApplication().invokeLater(() -> {
                        reply.append(chunk);
                        updateAssistantLine(reply.toString());
                    }),
                    err -> ApplicationManager.getApplication().invokeLater(() -> {
                        appendLine("Error", err);
                        refreshStatus();
                    }),
                    () -> ApplicationManager.getApplication().invokeLater(() -> {
                        if (reply.length() == 0) {
                            try {
                                String full = client.chat(prompt);
                                updateAssistantLine(full);
                            } catch (Exception ex) {
                                appendLine("Error", ex.getMessage());
                            }
                        } else {
                            appendNewline();
                        }
                        refreshStatus();
                    })
                );
            } catch (Exception ex) {
                ApplicationManager.getApplication().invokeLater(() -> {
                    appendLine("Error", ex.getMessage());
                    refreshStatus();
                });
            }
        });
    }

    public void sendMessage() {
        sendMessage(inputArea.getText());
    }

    public void refreshStatus() {
        ApplicationManager.getApplication().executeOnPooledThread(() -> {
            boolean ok = client.health();
            String url = CarinaSettings.getInstance().getServerUrl();
            ApplicationManager.getApplication().invokeLater(() -> {
                if (ok) {
                    statusLabel.setText("Connected to " + url);
                } else {
                    statusLabel.setText("Unreachable at " + url + " (run: carina web)");
                }
            });
        });
    }

    private void appendLine(String who, String text) {
        logArea.append(who + ":\n" + text + "\n\n");
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    private void appendRaw(String prefix) {
        logArea.append(prefix);
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    private void updateAssistantLine(String text) {
        String content = logArea.getText();
        int idx = content.lastIndexOf("Carina: ");
        if (idx >= 0) {
            logArea.setText(content.substring(0, idx) + "Carina: " + text);
        } else {
            logArea.append("Carina: " + text);
        }
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    private void appendNewline() {
        logArea.append("\n\n");
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }
}
