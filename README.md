# Music Console

第一阶段原型：一个为触摸屏设计的方形演奏区。横轴按当前音阶排列，从 C4 跨越两个八度，到 C6 结束。

## 本地运行

```sh
npm install
npm run dev
```

浏览器首次发声必须由用户手势触发。轻触音区发声，横向拖动换音，抬手停止。

## 树莓派 5

提交或复制最新的 `dist/` 后，可在 Raspberry Pi OS 桌面版中直接运行：

```sh
python3 main.py
```

日常运行只依赖 Python 3 和 Chromium。完整部署与启动选项见 [RASPBERRY_PI.md](./RASPBERRY_PI.md)。

## 验证

```sh
npm test
npm run build
```

当前声音来自 Web Audio API 的基础三角波，刻意与界面逻辑分离；以后可以把 `src/synth.js` 换成 SoundFont、采样器或远端音频引擎，而不需要重写触摸区域和音阶逻辑。

## iPhone 全屏运行

项目包含 Web App Manifest 和 iOS standalone 配置。在 Safari 或支持“添加到主屏幕”的 iOS 浏览器中打开网页，选择“添加到主屏幕”，然后从新图标启动，即可隐藏浏览器顶部地址栏和底部工具栏。它仍然是网页，不需要通过 App Store 安装。
