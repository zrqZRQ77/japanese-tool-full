(() => {
  if (typeof GLOBAL_SEARCH_ITEMS === 'undefined' || !Array.isArray(GLOBAL_SEARCH_ITEMS)) return;

  for (let index = GLOBAL_SEARCH_ITEMS.length - 1; index >= 0; index -= 1) {
    if (GLOBAL_SEARCH_ITEMS[index]?.label === '调整今日目标') {
      GLOBAL_SEARCH_ITEMS.splice(index, 1);
    }
  }

  const historyItem = GLOBAL_SEARCH_ITEMS.find(item => item?.label === '学习历史');
  if (historyItem) {
    historyItem.detail = '查看学习日历、进度和今日建议';
    historyItem.keywords = '历史 记录 进度 日历 今日 建议';
  }
})();
