;
(() => {
    const locker = {
        init() {
            const events = ["click", "keydown", "input"];
            events.forEach(event => window.addEventListener(event, this.handleEvent.bind(this)));

            this.updateUI();
            this.checkStatus();
        },

        updateUI() {
            document.title = chrome.i18n.getMessage("title_unlock");
            document.querySelector("#unlock-title").innerText = chrome.i18n.getMessage("title_locked");
            document.querySelector("#btn-unlock").innerText = chrome.i18n.getMessage("btn_unlock");
            document.querySelector("#unlock-passwd").placeholder = chrome.i18n.getMessage("notif_enter_passwd");
        },

        async unlock(withNotif = true) {
            const domNotif = document.querySelector("notif");
            const domPasswd = document.querySelector("#unlock-passwd");

            domNotif.value = ""; // Clear the notification text
            const passwd = domPasswd.value.trim();

            try {
                const response = await chrome.runtime.sendMessage({ type: "unlock", data: { passwd } });
                if (response?.success) {
                    return window.close();
                }

                if (withNotif) {
                    this.displayNotification(domNotif, chrome.i18n.getMessage("notif_wrong_passwd"));
                    domPasswd.value = ""; // Clear the password field
                }
            } catch (error) {
                console.error("Unlock failed:", error);
            }
        },

        displayNotification(element, message) {
            element.innerText = message;
            setTimeout(() => element.innerText = "", 3000); // Clear notification after 3 seconds
        },

        async checkStatus() {
            try {
                const response = await chrome.runtime.sendMessage({ type: "status" });
                if (!response?.data?.LOCKED) {
                    await chrome.windows.create();
                    window.close();
                }
            } catch (error) {
                console.error("Status check failed:", error);
            }
        },

        handleEvent(event) {
            const targetId = event.target.id;
            if (event.type === "click" && targetId === "btn-unlock") {
                this.unlock();
            } else if (event.type === "keydown" && targetId === "unlock-passwd" && event.key === "Enter") {
                this.unlock();
            } else if (event.type === "input" && targetId === "unlock-passwd") {
                this.unlock(false);
            }
        }
    };

    locker.init();
})();