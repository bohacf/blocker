import pbkdf2 from "./pbkdf2.js";

;
(async () => {
    let LOCKED = true;
    let PANNEL_OPENED = false;
    let PANNEL_ID = null;
    let CREATED_IS_PANNEL = false;
    let ALLOW_CHANGE = true;
    let RESTORE = false;

    let config = null;
    let PASSWD_SETED = null;

    const blocker = {
        init: async () => await blocker.handle(),

        digestMessage: async (message) => {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)]
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        },

        lock: async () => {
            const browserWindows = await chrome.windows.getAll({ populate: true });

            RESTORE = true;
            LOCKED = true;
            blocker.lockPannel();

            ALLOW_CHANGE = true;
            await chrome.storage.local.set({ sessions: browserWindows.length });
        },

        unlock: async (message, sender, sendResponse) => {
            const passwd = message?.data?.passwd;
            const { data, salt } = config?.passwd || {};

            const resDecrypt = await pbkdf2.decrypt(data, passwd, salt);
            if (resDecrypt) {
                LOCKED = false;
                if (RESTORE) {
                    let sessions = (await chrome.storage.local.get("sessions")).sessions;
                    // while (sessions--) await chrome.sessions.restore();
                    while (sessions > 0) {
                        await chrome.sessions.restore();
                        sessions--;
                    }
                    ALLOW_CHANGE = true;
                    await chrome.storage.local.remove("sessions");
                    RESTORE = false;
                } else {
                    await chrome.windows.create();
                }
                sendResponse({ type: message.type, success: true });
            } else {
                sendResponse({ type: message.type, success: false });
            }
            return false;
        },

        passwd: async (message, sender, sendResponse) => {
            const { passwdNew, passwdLast } = message?.data || {};
            const { data, salt } = config?.passwd || {};

            if (!config?.passwd) {
                const resEncrypt = await pbkdf2.encrypt(passwdNew);
                ALLOW_CHANGE = true;
                await chrome.storage.local.set({ passwd: resEncrypt });
                sendResponse({ type: "passwd", success: true });
            } else {
                const resDecrypt = await pbkdf2.decrypt(data, passwdLast, salt);
                if (resDecrypt) {
                    const resEncrypt = await pbkdf2.encrypt(passwdNew);
                    ALLOW_CHANGE = true;
                    await chrome.storage.local.set({ passwd: resEncrypt });
                    sendResponse({ type: "passwd", success: true });
                } else {
                    sendResponse({ type: "passwd", success: false });
                }
            }
        },

        lockPannel: async () => {
            if (!LOCKED) return;

            if (config === null || PASSWD_SETED === null) {
                config = await chrome.storage.local.get();
                PASSWD_SETED = !!config.passwd;
            }

            const windows = await chrome.windows.getAll();

            if (!PANNEL_OPENED) {
                const createdPannel = await chrome.windows.create({
                    type: "popup",
                    width: 640,
                    height: 480,
                    url: PASSWD_SETED ? "./html/unlock.html" : "./html/options.html"
                });
                CREATED_IS_PANNEL = true;
                PANNEL_ID = createdPannel?.id;
                PANNEL_OPENED = true;
            }
            await Promise.all(
                windows.map(win => win.id !== PANNEL_ID && chrome.windows.remove(win.id))
            );
            // for (const win in windows) {
            //     if (windows[win].id !== PANNEL_ID) {
            //         await chrome.windows.remove(windows[win].id);
            //     }
            // }
        },

        handle: async () => {
            chrome.windows.onCreated.addListener(() => blocker.lockPannel());

            chrome.windows.onRemoved.addListener(async windowId => {
                if (PANNEL_ID === windowId) {
                    PANNEL_OPENED = false;
                    PANNEL_ID = null;
                }
                if ((await chrome.windows.getAll()).length === 0) {
                    RESTORE = false;
                    LOCKED = true;
                }
            });

            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                switch (message.type) {
                    case "unlock":
                        blocker.unlock(message, sender, sendResponse);
                        break;
                    case "passwd":
                        blocker.passwd(message, sender, sendResponse);
                        break;
                    case "config":
                        sendResponse({ type: "config", success: true, data: config });
                        break;
                    case "status":
                        sendResponse({ type: "status", success: true, data: { PANNEL_OPENED: PANNEL_OPENED, LOCKED: LOCKED } })
                        break;
                }
                return true;
            });

            chrome.storage.onChanged.addListener(async (changes) => {
                if (!ALLOW_CHANGE) {
                    const newConfig = await chrome.storage.local.get();
                    const configDigest = await blocker.digestMessage(JSON.stringify(config));
                    const newConfigDigest = await blocker.digestMessage(JSON.stringify(newConfig));

                    if (configDigest !== newConfigDigest) {
                        await chrome.storage.local.set(config);
                    }
                } else {
                    ALLOW_CHANGE = false;
                }
            });

            chrome.runtime.onInstalled.addListener(async details => {
                if (details.reason === "install") {
                    chrome.runtime.openOptionsPage();
                } else if (details.reason === "update") {
                    if (config === null || PASSWD_SETED === null) {
                        config = await chrome.storage.local.get();
                        PASSWD_SETED = !!config.passwd;
                    }
                    LOCKED = false;
                }
            });

            chrome.action.onClicked.addListener(() => blocker.lock());
        }
    };

    await blocker.init();
})();