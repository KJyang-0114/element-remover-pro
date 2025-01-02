// 監聽插件安裝或更新事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('Element Remover installed/updated');
});

// 監聽插件圖標點擊事件
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 先嘗試注入腳本
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        console.log('Element Remover activated');
      }
    });

    // 然後發送消息
    await chrome.tabs.sendMessage(tab.id, { 
      action: "toggleSelector"
    });
  } catch (error) {
    console.error('Error:', error);
  }
}); 