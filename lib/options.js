let config;

const blo = {
    init: async () => {
        ["click", "input", "keydown"].forEach(eventType => 
            window.addEventListener(eventType, blo.handleEvent, false)
        );

        const domLast = document.querySelector("#passwd-last");
        const domTitle = document.querySelector("#passwd-title");
        
        domLast.style.display = config?.passwd ? "flex" : "none";
        domLast.placeholder=chrome.i18n.getMessage("title_last_passwd");
        domTitle.innerText = config?.passwd ? chrome.i18n.getMessage("title_change_passwd") : chrome.i18n.getMessage("title_set_passwd");

        document.querySelector("#passwd-new").placeholder=chrome.i18n.getMessage("title_new_passwd");;
        document.querySelector("#passwd-new-check").placeholder=chrome.i18n.getMessage("title_new_check_passwd");
        
        document.querySelector("#btn-save").innerText=chrome.i18n.getMessage("btn_save");
        document.querySelector("#link-review").innerText=chrome.i18n.getMessage("link_review");
        document.querySelector("#link-source").innerText=chrome.i18n.getMessage("link_source");

        document.querySelector("#link-review").href=`https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
        document.querySelector("#link-source").href=`https://github.com/zimocode/blocker`;
    },
    handleEvent: event => {
        if (event.type === "click" && event.target.id === "btn-save") {
            blo.passwd();
        } else if (event.type === "input") {
            event.target.value = event.target.value.trim();
        } else if (event.type === "keydown" && ["passwd-last", "passwd-new", "passwd-new-check"].includes(event.target.id) && event.keyCode === 13) {
            blo.passwd();
        }
    },
    passwd: async () => {
        const [domPasswdLast, domPasswdNew, domPasswdCheck] = ["#passwd-last", "#passwd-new", "#passwd-new-check"].map(id => document.querySelector(id));
        const [passwdLast, passwdNew, passwdCheck] = [domPasswdLast.value, domPasswdNew.value, domPasswdCheck.value].map(val => val.trim());

        const domNotif = document.querySelector("notif");
        if (passwdNew && passwdNew === passwdCheck) {
            const response = await chrome.runtime.sendMessage({ type: "passwd", data: { passwdNew, passwdLast } });
            domNotif.innerText = response?.success ? chrome.i18n.getMessage("notif_set_passwd") : chrome.i18n.getMessage("notif_last_wrong_passwd");
            if (response?.success) {
                setTimeout(async () => {
                    domNotif.innerText = "";
                    await chrome.runtime.reload();
                    window.close();
                }, 3000);
            } else {
                domPasswdLast.value = "";
                setTimeout(() => domNotif.innerText = "", 3000);
            }
        } else {
            domNotif.innerText = chrome.i18n.getMessage("notif_not_match_passwd");
            setTimeout(() => domNotif.innerText = "", 3000);
        }
    }
};

chrome.runtime.sendMessage({ type: "config" }, response => {
    if (response.success) {
        config = response.data;
        blo.init();
    }
});