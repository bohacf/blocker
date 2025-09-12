import pbkdf2 from "./pbkdf2.js";

;
(async () => {
    let LOCKED = false;
    let PANNEL_OPENED = false;
    let PANNEL_ID = null;
    let IS_CREATING_PANEL = false;
    let ALLOW_CHANGE = false;

    let config = null;
    let PASSWD_SETED = null;

    const blocker = {
        init: async () => await blocker.handle(),

        getConf: async () => {
            if (config === null || PASSWD_SETED === null) {
                config = await chrome.storage.local.get();
                PASSWD_SETED = !!config.passwd;
            }
        },

        digestMessage: async (message) => {
            const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        },

        lock: async (fromIcon = false) => {
            const { length: sessionCount } = await chrome.windows.getAll({ populate: true });

            LOCKED = true;
            blocker.lockPannel(fromIcon);

            await chrome.storage.session.set({ sessions: sessionCount });
        },

        unlock: async (message, sender, sendResponse) => {
            await blocker.getConf();

            const passwd = message?.data?.passwd;
            const { data, salt } = config?.passwd || {};

            const resDecrypt = await pbkdf2.decrypt(data, passwd, salt);
            if (resDecrypt) {
                LOCKED = false;

                let sessions = (await chrome.storage.session.get("sessions")).sessions;
                if (sessions > 0) {
                    while (sessions > 0) {
                        await chrome.sessions.restore();
                        sessions--;
                    }
                    await chrome.storage.session.remove("sessions");
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
            await blocker.getConf();
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

        lockPannel: async (fromIcon = false) => {
            if (!LOCKED || IS_CREATING_PANEL) return;

            try {
                await blocker.getConf();

                if (!PASSWD_SETED) {
                    if (fromIcon) {
                        await chrome.windows.create({
                            type: "popup",
                            width: 640,
                            height: 580,
                            focused: true,
                            url: "./html/options.html"
                        });
                    }
                    return;
                }

                if (!PANNEL_OPENED) {
                    IS_CREATING_PANEL = true;
                    const createdPannel = await chrome.windows.create({
                        type: "popup",
                        width: 520,
                        height: 370,
                        focused: true,
                        url: PASSWD_SETED ? "./html/unlock.html" : "./html/options.html"
                    });
                    PANNEL_ID = createdPannel?.id ?? null;
                    PANNEL_OPENED = !!PANNEL_ID;
                    // tiny delay to let Chrome register the new window fully before enumerating/removing others
                    await new Promise(r => setTimeout(r, 50));
                }

                const windows = await chrome.windows.getAll();
                const toRemove = windows.filter(win => win?.id && win.id !== PANNEL_ID);
                for (const win of toRemove) {
                    try {
                        // verify window still exists
                        await chrome.windows.get(win.id);
                        await chrome.windows.remove(win.id);
                    } catch (_) {
                        // ignore: already gone or race
                    }
                }
            } catch (e) {
                console.debug("lockPannel soft error (ignored):", e?.message || e);
            } finally {
                IS_CREATING_PANEL = false;
            }
        },

        handle: async () => {
            chrome.windows.onCreated.addListener(() => blocker.lockPannel());

            chrome.runtime.onStartup.addListener(() => {
                LOCKED = true;
                blocker.lockPannel();
            });

            chrome.windows.onRemoved.addListener(async windowId => {
                if (PANNEL_ID === windowId) {
                    PANNEL_OPENED = false;
                    PANNEL_ID = null;
                }
                if ((await chrome.windows.getAll()).length === 0) {
                    LOCKED = true;
                }
            });

            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                const actions = {
                    unlock: () => blocker.unlock(message, sender, sendResponse),
                    passwd: () => blocker.passwd(message, sender, sendResponse),
                    config: async() => {
                        await blocker.getConf();
                        sendResponse({ type: "config", success: true, data: config });
                    },
                    status: () => sendResponse({ type: "status", success: true, data: { PANNEL_OPENED, LOCKED } })
                };

                if (actions[message.type]) actions[message.type]();
                return true;
            });

            chrome.storage.onChanged.addListener(async (changes) => {
                await blocker.getConf();

                if (ALLOW_CHANGE) {
                    ALLOW_CHANGE = false;
                    return;
                }

                const newConfig = await chrome.storage.local.get();
                const [configDigest, newConfigDigest] = await Promise.all([
                    blocker.digestMessage(JSON.stringify(config)),
                    blocker.digestMessage(JSON.stringify(newConfig))
                ]);

                if (configDigest !== newConfigDigest) {
                    await chrome.storage.local.set(config);
                }
            });

            chrome.runtime.onInstalled.addListener(async details => {
                if (details.reason === "install") {
                    chrome.runtime.openOptionsPage();
                } else if (details.reason === "update") {
                    await blocker.getConf();
                    LOCKED = false;
                }
            });

            chrome.action.onClicked.addListener(() => blocker.lock(true));
        }
    };

    await blocker.init();
})();