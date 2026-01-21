// 后台服务工作脚本

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "showTabKeeper",
    title: "显示 TabKeeper 主页",
    contexts: ["action"],
  });
});

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "showTabKeeper") {
    openTabKeeperPage();
  }
});

// 打开 TabKeeper 主页
async function openTabKeeperPage() {
  // 查找是否已经有 TabKeeper 标签页
  const tabs = await chrome.tabs.query({});
  const tabKeeperTab = tabs.find(
    (t) => t.url && t.url.includes("tabkeeper.html"),
  );

  if (tabKeeperTab) {
    // 如果已存在，激活该标签页
    await chrome.tabs.update(tabKeeperTab.id, { active: true });
    await chrome.windows.update(tabKeeperTab.windowId, { focused: true });
  } else {
    // 如果不存在，创建新标签页
    await chrome.tabs.create({ url: "tabkeeper.html" });
  }
}

// 点击扩展图标 - 保存当前窗口的所有标签页
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 获取当前窗口的所有标签页
    const window = await chrome.windows.getCurrent({ populate: true });
    const tabs = window.tabs;

    // 过滤掉 TabKeeper 自己的标签页
    const tabsToSave = tabs.filter((t) => !t.url.includes("tabkeeper.html"));

    if (tabsToSave.length === 0) {
      return;
    }

    // 创建新的标签页组
    const tabGroup = {
      id: Date.now().toString(),
      title: "",
      category: "未分类",
      createdAt: Date.now(),
      tabs: tabsToSave.map((t) => ({
        title: t.title,
        url: t.url,
        favIconUrl: t.favIconUrl,
      })),
    };

    // 保存到存储
    const { tabGroups = [] } = await chrome.storage.local.get("tabGroups");
    tabGroups.unshift(tabGroup); // 新的组添加到最前面
    await chrome.storage.local.set({ tabGroups });

    // 同步到云端
    try {
      await chrome.storage.sync.set({
        lastSync: Date.now(),
        syncData: JSON.stringify(tabGroups.slice(0, 50)), // 云存储有限制，只同步最近50组
      });
    } catch (e) {
      console.warn("云同步失败:", e);
    }

    // 关闭已保存的标签页
    const tabIdsToClose = tabsToSave.map((t) => t.id);
    await chrome.tabs.remove(tabIdsToClose);

    // 检查是否还有 TabKeeper 标签页
    const remainingTabs = await chrome.tabs.query({ windowId: window.id });
    const hasTabKeeperTab = remainingTabs.some(
      (t) => t.url && t.url.includes("tabkeeper.html"),
    );

    if (!hasTabKeeperTab) {
      // 如果没有 TabKeeper 标签页，打开一个
      await openTabKeeperPage();
    } else {
      // 如果有 TabKeeper 标签页，激活它
      const tabKeeperTab = remainingTabs.find(
        (t) => t.url && t.url.includes("tabkeeper.html"),
      );
      if (tabKeeperTab) {
        await chrome.tabs.update(tabKeeperTab.id, { active: true });
      }
    }
  } catch (error) {
    console.error("保存标签页失败:", error);
  }
});

// 监听来自页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "restoreTabs") {
    restoreTabs(request.tabs, request.removeAfterRestore).then(sendResponse);
    return true; // 异步响应
  } else if (request.action === "exportData") {
    exportData().then(sendResponse);
    return true;
  }
});

// 恢复标签页
async function restoreTabs(tabs, removeAfterRestore = true) {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const currentTabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // 判断是否在新窗口打开
    const isOnlyTabKeeper =
      currentTabs.length === 1 && currentTabs[0].url.includes("tabkeeper.html");

    if (isOnlyTabKeeper) {
      // 在当前窗口打开
      for (const tab of tabs) {
        await chrome.tabs.create({ url: tab.url, active: false });
      }
    } else {
      // 在新窗口打开
      const newWindow = await chrome.windows.create({ url: tabs[0].url });
      for (let i = 1; i < tabs.length; i++) {
        await chrome.tabs.create({
          windowId: newWindow.id,
          url: tabs[i].url,
          active: false,
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("恢复标签页失败:", error);
    return { success: false, error: error.message };
  }
}

// 导出数据
async function exportData() {
  const { tabGroups = [] } = await chrome.storage.local.get("tabGroups");
  return { data: tabGroups };
}
