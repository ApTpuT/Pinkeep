console.log('Background script loaded!');

function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

let pinnedTabDomains = new Map();

// Initialization: save domains of existing pinned tabs
browser.tabs.query({ pinned: true }).then(tabs => {
    tabs.forEach(tab => {
        const domain = getDomain(tab.url);
        if (domain) {
            pinnedTabDomains.set(tab.id, domain);
        }
    });
});

// Track pinning/unpinning of tabs
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.pinned === true) {
        const domain = getDomain(tab.url);
        if (domain) {
            pinnedTabDomains.set(tabId, domain);
        }
    } else if (changeInfo.pinned === false) {
        pinnedTabDomains.delete(tabId);
    }
});

browser.tabs.onRemoved.addListener((tabId) => {
    pinnedTabDomains.delete(tabId);
});

// Intercept requests before they start
browser.webRequest.onBeforeRequest.addListener(
    async (details) => {
        // Проверяем только главный документ
        if (details.type !== 'main_frame') {
            return;
        }

        try {
            const tab = await browser.tabs.get(details.tabId);

            // Check pinned tabs only
            if (!tab.pinned) {
                return;
            }

            const originalDomain = pinnedTabDomains.get(tab.id);
            const newDomain = getDomain(details.url);

            console.log('Request detected:', {
                originalDomain,
                newDomain,
                url: details.url,
                tabId: details.tabId
            });

            // If domains are different
            if (originalDomain && newDomain && originalDomain !== newDomain) {
                console.log('Different domain detected, opening in new tab');

                // Open in a new tab
                browser.tabs.create({
                    url: details.url,
                    active: true,
                    index: tab.index + 1
                });

                // Block the original request
                return { cancel: true };
            }
        } catch (error) {
            console.error('Error handling request:', error);
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);