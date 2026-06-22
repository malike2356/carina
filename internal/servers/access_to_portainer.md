That command is correct. Use it like this:

### 1. Start the tunnel (leave this terminal open)

```bash
ssh -L 9443:127.0.0.1:9443 aman
```

What it does: traffic to **your machine’s** `localhost:9443` is forwarded to Portainer on the VPS.

### 2. Open Portainer in the browser

While that SSH session is still connected:

**https://localhost:9443**

Not the Contabo IP; use `localhost` once the tunnel is up.

### 3. Certificate warning

You may see a browser warning (self-signed cert). That’s expected; continue to the site.

---

**Tip:** To keep the tunnel in the background:

```bash
ssh -fN -L 9443:127.0.0.1:9443 aman
```

Then open **https://localhost:9443**. To stop it later:

```bash
pkill -f 'ssh -fN -L 9443'
```

---

If it fails:

- **`Address already in use`**; something else is on port 9443 locally; use another port:
  ```bash
  ssh -L 19443:127.0.0.1:9443 aman
  ```
  Then open **https://localhost:19443**

- **`Connection refused`**; SSH works (verified), so this usually means the tunnel terminal was closed or the wrong URL was used (IP instead of `localhost`).
