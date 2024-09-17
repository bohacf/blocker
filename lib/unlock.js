const locker = {
    init() {
        window.addEventListener("click", this.handleEvent.bind(this));
        window.addEventListener("keydown", this.handleEvent.bind(this));

        document.title = chrome.i18n.getMessage("title_unlock");
        document.querySelector("#unlock-title").innerText = chrome.i18n.getMessage("title_locked");
        document.querySelector("#btn-unlock").innerText = chrome.i18n.getMessage("btn_unlock");
        document.querySelector("#unlock-passwd").placeholder = chrome.i18n.getMessage("notif_enter_passwd");

        locker.checkStatus();
    },
    async unlock() {
        const domNotif = document.querySelector("notif");
        
        const passwd = document.querySelector("#unlock-passwd").value.trim();
        const response = await chrome.runtime.sendMessage({ type: "unlock", data: { passwd } });
        if (response?.success) {
            window.close();
        } else {
            domNotif.innerText = chrome.i18n.getMessage("notif_wrong_passwd");
            document.querySelector("#unlock-passwd").value = "";
            setTimeout(() => domNotif.innerText = "", 3000);
        }
    },
    async checkStatus() {
        const response = await chrome.runtime.sendMessage({ type: "status" });
        if (response?.data?.LOCKED===false) {
            await chrome.windows.create();
            window.close();
        }
    },
    handleEvent(event) {
        if (event.type === "click" && event.target.id === "btn-unlock") {
            this.unlock();
        } else if (event.type === "keydown" && event.target.id === "unlock-passwd" && event.keyCode === 13) {
            this.unlock();
        }
    }
};

locker.init();