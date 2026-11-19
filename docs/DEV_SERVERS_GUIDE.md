# Dev Servers Guide: starting the app the easy way

> Written 2026-11-16. Run commands from the **project root folder**
> (`C:\xampp\htdocs\AI-Driven-Voucher-Monitoring-System`), not from `backend` or `frontend`.

## 1. Do I need to restart after changing code? Usually NO

| You changed… | What happens | Restart needed? |
| --- | --- | --- |
| A React file (`.jsx`, `.js`, `.css`) | Vite updates the open browser tab **instantly** when you save. This is called **Hot Module Replacement (HMR)**. | ❌ No |
| A PHP file (controller, model, route, migration code) | Laravel reads the PHP code fresh on **every request**. Just refresh the page or click again. | ❌ No |
| `backend/.env` or `.env.testing` | Settings are read once, when the server starts. | ✅ Yes |
| Switching real ↔ testing database | Same reason. | ✅ Yes |
| `frontend/vite.config.js` | Vite usually restarts itself. If not, restart. | Sometimes |
| Installed a new npm/composer package | Usually picked up automatically. Restart if something looks off. | Sometimes |

So you start the servers **once** when you begin working, and stop them when you're done.

---

## 2. Option A: one command, both servers (`dev.ps1`)

In a **PowerShell** terminal at the project root:

```powershell
.\dev.ps1            # real database
.\dev.ps1 -Testing   # testing database (sample users, password "password")
```

You'll see both servers' messages in one window, labelled:

```
[backend ]  INFO  Server running on [http://127.0.0.1:8000].
[frontend]  VITE v8  ready in 226 ms
```

Open **http://localhost:5173**.

**To stop both:** press **Ctrl+C** once. The script stops both servers (and the hidden helper processes they start), then prints:
```
  backend (:8000): stopped
  frontend (:5173): stopped
```

**If it says "Port 8000 (or 5173) is already in use":** a server is still running from before, for example an old `php artisan serve` or `npm run dev` in another terminal. Stop that one first (Ctrl+C in its terminal, or close the terminal), then run `.\dev.ps1` again.

---

## 3. Option B: one click in VS Code (tasks)

1. Press **Ctrl+Shift+P**.
2. Type **Run Task** and choose **Tasks: Run Task**.
3. Pick one of these:
   - **Dev: start both (real database)**
   - **Dev: start both (testing database, sample users)**

Each server opens in its own terminal tab, side by side. To stop one, click the **trash-can icon** on its terminal. The tasks are defined in `.vscode/tasks.json`.

> **Tip: start automatically when you open the project.** In `.vscode/tasks.json`, add
> `"runOptions": { "runOn": "folderOpen" }` to the task you want (for example the testing one).
> VS Code asks once whether to allow automatic tasks. Choose **Allow**.
> It's not switched on by default, so the servers don't start every time you only want to read code.

---

## 4. Which option should I use?

| | `dev.ps1` | VS Code tasks |
| --- | --- | --- |
| Start | Type one command | Two clicks (or automatic) |
| Output | One window, labelled lines | Two terminal tabs |
| Stop | Ctrl+C once stops both | Trash-can on each tab |
| Works outside VS Code | ✅ Yes | ❌ No |

Both do the same thing, so use whichever you like. The old manual way (two terminals:
`php artisan serve` in `backend`, `npm run dev` in `frontend`) still works too.

---

## 5. How it works (the concepts)

- **Background job (PowerShell `Start-Job`):** runs a command "behind the scenes", so one script can run two servers at once and read both outputs.
- **Process tree:** `php artisan serve` secretly starts a second `php` process (the real web server), and `npm run dev` starts `node`. Stopping only the parent would leave the children running and the port stuck. So the script stops the whole tree (`taskkill /T`).
- **`try / finally`:** the `finally` part runs even when you press Ctrl+C. That's where the cleanup lives.
- **`strictPort: true`** (in `frontend/vite.config.js`): if 5173 is busy, Vite stops with an error instead of quietly moving to 5174. That matters because the backend only trusts `localhost:5173` for login cookies.
- **Port check by connecting:** on this PC, Windows' `Get-NetTCPConnection` sometimes reports a busy port as free. So the script actually tries to connect to the port (IPv4 and IPv6) to see if something answers.
