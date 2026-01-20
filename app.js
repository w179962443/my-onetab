// 全局状态
let allTabGroups = [];
let filteredTabGroups = [];
let categories = ["未分类"];
let currentCategory = "all";
let currentPage = 1;
const itemsPerPage = 10; // 每页显示10个组，优化性能
let editingGroupId = null;

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupEventListeners();
  renderTabGroups();
});

// 加载数据
async function loadData() {
  try {
    // 从本地存储加载
    const { tabGroups = [], customCategories = [] } =
      await chrome.storage.local.get(["tabGroups", "customCategories"]);
    allTabGroups = tabGroups;

    // 合并自定义分类
    if (customCategories.length > 0) {
      categories = ["未分类", ...customCategories];
    }

    // 尝试从云端同步
    try {
      const { syncData, lastSync } = await chrome.storage.sync.get([
        "syncData",
        "lastSync",
      ]);
      if (syncData) {
        const cloudGroups = JSON.parse(syncData);
        // 简单合并策略：如果云端数据更新，使用云端数据
        if (lastSync && (!tabGroups.length || lastSync > Date.now() - 60000)) {
          allTabGroups = cloudGroups;
          await chrome.storage.local.set({ tabGroups: cloudGroups });
        }
      }
    } catch (e) {
      console.warn("云同步加载失败:", e);
    }

    updateCategoryList();
    updateTotalCount();
  } catch (error) {
    console.error("加载数据失败:", error);
  }
}

// 设置事件监听
function setupEventListeners() {
  // 分类筛选
  document.getElementById("categoryFilter").addEventListener("click", () => {
    const panel = document.getElementById("categoryPanel");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });

  // 分类按钮
  document.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".category-item")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.dataset.category;
      currentPage = 1;
      renderTabGroups();
    });
  });

  // 添加分类
  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    showModal("newCategoryModal");
  });

  document
    .getElementById("createCategory")
    .addEventListener("click", async () => {
      const input = document.getElementById("newCategoryInput");
      const categoryName = input.value.trim();
      if (categoryName && !categories.includes(categoryName)) {
        categories.push(categoryName);
        await chrome.storage.local.set({
          customCategories: categories.slice(1),
        });
        updateCategoryList();
        input.value = "";
        hideModal("newCategoryModal");
      }
    });

  document.getElementById("cancelNewCategory").addEventListener("click", () => {
    hideModal("newCategoryModal");
  });

  // 云同步
  document.getElementById("syncBtn").addEventListener("click", syncToCloud);

  // 导出备份
  document.getElementById("exportBtn").addEventListener("click", exportBackup);

  // 导入备份
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });

  document
    .getElementById("importFile")
    .addEventListener("change", importBackup);

  // 搜索
  document.getElementById("searchInput").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    if (query) {
      filteredTabGroups = allTabGroups.filter(
        (group) =>
          group.title.toLowerCase().includes(query) ||
          group.tabs.some(
            (tab) =>
              tab.title.toLowerCase().includes(query) ||
              tab.url.toLowerCase().includes(query),
          ),
      );
    } else {
      filteredTabGroups = [];
    }
    currentPage = 1;
    renderTabGroups();
  });

  // 分页
  document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTabGroups();
    }
  });

  document.getElementById("nextPage").addEventListener("click", () => {
    const maxPage = Math.ceil(getDisplayGroups().length / itemsPerPage);
    if (currentPage < maxPage) {
      currentPage++;
      renderTabGroups();
    }
  });

  // 编辑标题弹窗
  document.getElementById("saveTitle").addEventListener("click", async () => {
    const newTitle = document.getElementById("editTitleInput").value.trim();
    if (editingGroupId) {
      const group = allTabGroups.find((g) => g.id === editingGroupId);
      if (group) {
        group.title = newTitle;
        await saveData();
        renderTabGroups();
      }
    }
    hideModal("editModal");
  });

  document.getElementById("cancelEdit").addEventListener("click", () => {
    hideModal("editModal");
  });

  // 选择分类弹窗
  document
    .getElementById("saveCategory")
    .addEventListener("click", async () => {
      const newCategory = document.getElementById("categorySelect").value;
      if (editingGroupId) {
        const group = allTabGroups.find((g) => g.id === editingGroupId);
        if (group) {
          group.category = newCategory;
          await saveData();
          renderTabGroups();
        }
      }
      hideModal("categoryModal");
    });

  document.getElementById("cancelCategory").addEventListener("click", () => {
    hideModal("categoryModal");
  });

  // 监听存储变化（实现实时更新）
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.tabGroups) {
      allTabGroups = changes.tabGroups.newValue || [];
      renderTabGroups();
      updateTotalCount();
    }
  });
}

// 获取要显示的组
function getDisplayGroups() {
  let groups = filteredTabGroups.length > 0 ? filteredTabGroups : allTabGroups;

  if (currentCategory !== "all") {
    groups = groups.filter((g) => g.category === currentCategory);
  }

  return groups;
}

// 渲染标签页组列表
function renderTabGroups() {
  const container = document.getElementById("tabGroupsList");
  const emptyState = document.getElementById("emptyState");
  const pagination = document.getElementById("pagination");

  const groups = getDisplayGroups();

  if (groups.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    pagination.style.display = "none";
    return;
  }

  emptyState.style.display = "none";

  // 分页
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageGroups = groups.slice(startIdx, endIdx);

  container.innerHTML = pageGroups
    .map(
      (group) => `
    <div class="tab-group" data-group-id="${group.id}">
      <div class="group-header">
        <div class="group-info">
          <span class="group-title ${!group.title ? "empty" : ""}" 
                onclick="editTitle('${group.id}')">
            ${group.title || "点击编辑标题"}
          </span>
          <span class="group-category" onclick="editCategory('${group.id}')">
            ${group.category}
          </span>
          <span class="group-meta">
            ${new Date(group.createdAt).toLocaleString("zh-CN")} · ${group.tabs.length} 个标签页
          </span>
        </div>
        <div class="group-actions">
          <button class="btn btn-primary btn-sm" onclick="restoreGroup('${group.id}')">
            恢复全部
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteGroup('${group.id}')">
            删除
          </button>
        </div>
      </div>
      <ul class="tab-list">
        ${group.tabs
          .map(
            (tab, idx) => `
          <li class="tab-item" onclick="restoreTab('${group.id}', ${idx})">
            <img class="tab-favicon" 
                 src="${tab.favIconUrl || "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2214%22 font-size=%2214%22>🌐</text></svg>"}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2214%22 font-size=%2214%22>🌐</text></svg>'">
            <span class="tab-title">${escapeHtml(tab.title)}</span>
            <button class="tab-delete" onclick="deleteTab(event, '${group.id}', ${idx})">删除</button>
          </li>
        `,
          )
          .join("")}
      </ul>
    </div>
  `,
    )
    .join("");

  // 更新分页信息
  const totalPages = Math.ceil(groups.length / itemsPerPage);
  if (totalPages > 1) {
    pagination.style.display = "flex";
    document.getElementById("pageInfo").textContent =
      `第 ${currentPage} / ${totalPages} 页`;
    document.getElementById("prevPage").disabled = currentPage === 1;
    document.getElementById("nextPage").disabled = currentPage === totalPages;
  } else {
    pagination.style.display = "none";
  }
}

// 恢复整个组
async function restoreGroup(groupId) {
  const group = allTabGroups.find((g) => g.id === groupId);
  if (!group) return;

  const result = await chrome.runtime.sendMessage({
    action: "restoreTabs",
    tabs: group.tabs,
    removeAfterRestore: true,
  });

  if (result.success) {
    // 从列表删除
    allTabGroups = allTabGroups.filter((g) => g.id !== groupId);
    await saveData();
    renderTabGroups();
  }
}

// 恢复单个标签页
async function restoreTab(groupId, tabIndex) {
  const group = allTabGroups.find((g) => g.id === groupId);
  if (!group) return;

  const tab = group.tabs[tabIndex];

  // 打开标签页
  await chrome.runtime.sendMessage({
    action: "restoreTabs",
    tabs: [tab],
    removeAfterRestore: true,
  });

  // 从列表删除该标签页
  group.tabs.splice(tabIndex, 1);

  // 如果组为空，删除组
  if (group.tabs.length === 0) {
    allTabGroups = allTabGroups.filter((g) => g.id !== groupId);
  }

  await saveData();
  renderTabGroups();
}

// 删除标签页
async function deleteTab(event, groupId, tabIndex) {
  event.stopPropagation();

  const group = allTabGroups.find((g) => g.id === groupId);
  if (!group) return;

  group.tabs.splice(tabIndex, 1);

  if (group.tabs.length === 0) {
    allTabGroups = allTabGroups.filter((g) => g.id !== groupId);
  }

  await saveData();
  renderTabGroups();
}

// 删除整个组
async function deleteGroup(groupId) {
  if (!confirm("确定要删除这个标签页组吗？")) return;

  allTabGroups = allTabGroups.filter((g) => g.id !== groupId);
  await saveData();
  renderTabGroups();
}

// 编辑标题
function editTitle(groupId) {
  editingGroupId = groupId;
  const group = allTabGroups.find((g) => g.id === groupId);
  if (group) {
    document.getElementById("editTitleInput").value = group.title;
    showModal("editModal");
  }
}

// 编辑分类
function editCategory(groupId) {
  editingGroupId = groupId;
  const group = allTabGroups.find((g) => g.id === groupId);
  if (group) {
    const select = document.getElementById("categorySelect");
    select.innerHTML = categories
      .map(
        (cat) =>
          `<option value="${cat}" ${cat === group.category ? "selected" : ""}>${cat}</option>`,
      )
      .join("");
    showModal("categoryModal");
  }
}

// 更新分类列表
function updateCategoryList() {
  const categoryList = document.querySelector(".category-list");
  categoryList.innerHTML = `
    <button class="category-item ${currentCategory === "all" ? "active" : ""}" data-category="all">全部</button>
    ${categories
      .map(
        (cat) => `
      <button class="category-item ${currentCategory === cat ? "active" : ""}" data-category="${cat}">${cat}</button>
    `,
      )
      .join("")}
  `;

  // 重新绑定事件
  categoryList.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".category-item")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.dataset.category;
      currentPage = 1;
      renderTabGroups();
    });
  });
}

// 更新总数统计
function updateTotalCount() {
  const totalCount = allTabGroups.reduce(
    (sum, group) => sum + group.tabs.length,
    0,
  );
  document.getElementById("totalCount").textContent = totalCount;
}

// 云同步
async function syncToCloud() {
  try {
    await chrome.storage.sync.set({
      lastSync: Date.now(),
      syncData: JSON.stringify(allTabGroups.slice(0, 50)),
    });
    alert("✅ 云同步成功！");
  } catch (error) {
    alert("❌ 云同步失败：" + error.message);
  }
}

// 导出备份
async function exportBackup() {
  const data = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    tabGroups: allTabGroups,
    categories: categories,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tabkeeper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入备份
async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.tabGroups) {
      throw new Error("无效的备份文件");
    }

    if (confirm("导入备份会覆盖当前数据，确定继续吗？")) {
      allTabGroups = data.tabGroups;
      if (data.categories) {
        categories = data.categories;
        await chrome.storage.local.set({
          customCategories: categories.slice(1),
        });
      }
      await saveData();
      updateCategoryList();
      renderTabGroups();
      alert("✅ 导入成功！");
    }
  } catch (error) {
    alert("❌ 导入失败：" + error.message);
  }

  event.target.value = "";
}

// 保存数据
async function saveData() {
  await chrome.storage.local.set({ tabGroups: allTabGroups });
  updateTotalCount();
}

// 显示弹窗
function showModal(modalId) {
  document.getElementById(modalId).classList.add("show");
}

// 隐藏弹窗
function hideModal(modalId) {
  document.getElementById(modalId).classList.remove("show");
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 全局函数（供HTML调用）
window.restoreGroup = restoreGroup;
window.restoreTab = restoreTab;
window.deleteTab = deleteTab;
window.deleteGroup = deleteGroup;
window.editTitle = editTitle;
window.editCategory = editCategory;
