# 在树莓派 5 上运行

这个版本以 `main.py` 作为统一入口。它会在本机启动网页服务，并用独立的 Chromium 窗口打开已经构建好的 `dist/`。日常运行只需要 Python 3，不需要启动 Vite，也不要使用 `sudo`。

## 前置条件

- 64 位 Raspberry Pi OS 桌面版；
- Python 3（系统自带）；
- Chromium 浏览器；
- 可用的桌面会话和音频输出。

## 把项目放到树莓派

将完整的 `music-console` 项目文件夹复制或克隆到树莓派，必须包含：

```text
music-console/
├── dist/
├── main.py
└── ...
```

如果通过 Git 获取项目，请先确认仓库已经提交了最新的 `dist/`，然后运行：

```sh
mkdir -p ~/apps
cd ~/apps
git clone <你的仓库地址> music-console
cd music-console
python3 main.py
```

首次进入演奏界面后，需要触摸或点击一次，浏览器才会允许发声。

## 日常启动

```sh
cd ~/apps/music-console
python3 main.py
```

常用选项：

```text
python3 main.py                 默认全屏
python3 main.py --windowed      普通窗口，适合调试
python3 main.py --kiosk         锁定式全屏，按 Alt+F4 退出
python3 main.py --no-browser    只启动本地网页服务
python3 main.py --port 17325    更换本地端口
python3 main.py --help          查看完整帮助
```

如果程序没有自动找到 Chromium：

```sh
python3 main.py --browser /usr/bin/chromium
```

## 更新前端内容

`main.py` 运行的是 `dist/`，不是开发源码。修改 `index.html`、`src/` 或 `public/` 后，先在装有 Node.js 的开发电脑上重新构建：

```sh
npm install
npm test
npm run build
```

然后把更新后的项目（尤其是新的 `dist/`）同步到树莓派，再运行 `python3 main.py`。树莓派本身无需安装 Node.js。

## 与其他音乐软件隔离

- 网页服务只监听 `127.0.0.1`，不会向局域网开放；
- Chromium 使用独立数据目录 `~/.local/share/music-console/chromium`；
- 程序不会写入系统目录，也不会修改开机启动项；
- 关闭 Chromium 应用窗口后，本地网页服务会一并停止；
- 工程、自动保存和撤销记录保存在独立 Chromium 数据目录中，更新项目文件不会删除这些数据。
