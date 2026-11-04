const {contextBridge} = require('electron');

contextBridge.exposeInMainWorld('easyCook', {
  isReady: true
});
