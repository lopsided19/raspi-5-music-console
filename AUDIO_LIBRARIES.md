# 免费音色库候选（2026-08-06 核查）

这里的“音色库”指接收 MIDI 音符并发声的 SoundFont、SFZ 或采样器音源。MIDI 本身只包含音符、力度、控制器等演奏数据，并不包含声音。

## 建议路线

当前原型继续使用 `src/synth.js` 中无下载、低延迟的 Web Audio 合成器。需要试听真实乐器时，优先按下面两条路线分开处理：

1. **网页产品可随应用分发：** 先试 GeneralUser GS；更重视授权确定性时，用 VSCO 2 CE 的 CC0 原始 WAV 自建少量精选乐器。加载策略应按乐器/音区拆包并缓存，不要让手机首次打开就下载整套音色。
2. **开发期在 DAW/桌面宿主中选音和做质量标杆：** 安装 Komplete Start、SINEfactory、SampleTank 4 CS、Splice INSTRUMENT 等大厂免费库。它们可以长期用于个人创作，但通常禁止把原始采样重新封装进自己的网页乐器。

## A. 更适合作为网页运行时资产

### 1. GeneralUser GS 2.0.3

- 类型：完整 GM/GS SoundFont；261 个音色、13 套鼓，约 30.7 MB 内存占用。
- 优点：覆盖面最完整、体积小、非常成熟；官方列出 FluidSynth 与浏览器端 SpessaSynth 为完整兼容引擎。
- 用途：最适合成为第一套“一个文件覆盖常见乐器”的开发基线。
- 授权：允许用它创作及发布音乐；若把 SoundFont 随软件分发，仍需逐条遵守包内 `LICENSE.txt`，集成前再做一次授权复核。
- 官方：[GeneralUser GS](https://schristiancollins.com/generaluser.php)

### 2. FluidR3 GM

- 类型：老牌完整 GM SoundFont，约 140 MB。
- 优点：比 GeneralUser 更大、生态成熟，FluidSynth 官方文档长期将它列为可用的 GM 音色库。
- 用途：适合做第二套 A/B 对照音源或桌面端回放基线。
- 注意：来源较老，网上镜像很多；只从可追溯发行源取得，并保留随包授权文件，不要依据下载站一句“免费”判断可再分发性。
- 官方参考：[FluidSynth SoundFont 资源说明](https://www.fluidsynth.org/wiki/SoundFont/)

### 3. VSCO 2 Community Edition

- 类型：室内管弦乐，约 3 GB，提供 SFZ 与原始 WAV。
- 优点：Versilian Studios 出品；CC0，无版税、无使用限制，原始 WAV 很适合裁剪成网页端的轻量乐器包。
- 覆盖：弦乐、木管、铜管、打击乐等管弦乐器；不负责吉他、贝斯、合成器等完整 GM 覆盖。
- 用途：授权最干净的高质量管弦乐补充，也是将来允许随产品分发的优先素材源。
- 官方：[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)

### 4. FreePats

- 类型：自由授权的 GM、单乐器和打击乐音色集合，格式与每件乐器的授权可能不同。
- 优点：开放素材来源多，可用于补 GeneralUser/VSCO 没覆盖好的个别乐器。
- 注意：这是集合，不是“全库统一授权”；接入前必须记录每个具体音色的作者、来源与授权。
- 官方：[FreePats sound banks](https://freepats.zenvoid.org/)

## B. 大厂高质量库，适合开发期选音和制作，不适合把采样嵌入网页

### 5. Native Instruments Komplete Start

- 类型：免费 Kontakt 8 Player 套装。
- 覆盖：Kontakt Factory Selection 2 包含 Acoustic、Band、Beats、Choir、Orchestral、Synth、Vintage；另有 Massive X Player、Irish Harp、Yangqin 等。
- 优点：大牌、类型覆盖很广，适合建立“我们希望网页音色达到什么水平”的听觉参考。
- 限制：NI 允许用音色做商业或非商业音乐，但明确禁止把 samples/instruments/presets 用来制作或重新分发另一套音色库或虚拟乐器，所以不能直接打包到本网页。
- 官方：[Komplete Start 内容](https://support.native-instruments.com/support/solutions/articles/69000880011-native-instruments-what-is-komplete-start-) · [NI EULA](https://www.native-instruments.com/en/company/legal-information/end-user-license-agreement/)

### 6. Orchestral Tools SINEfactory + Berlin Free Orchestra

- 类型：免费 SINEplayer 音源。
- 覆盖：完整管弦乐，以及钢琴、电钢、风琴、贝斯、原声吉他、尤克里里、鼓、打击乐、长笛、大乐队铜管、人声等独立库。
- 优点：专业影视配乐厂牌，单件乐器质量通常高于通用 GM SoundFont；领取进账户后官方写明可永久保留。
- 限制：依赖 SINEplayer；作为开发期/DAW 音源使用，不把原始采样抽出后随网页发布。
- 官方：[SINEfactory](https://www.orchestraltools.com/sinefactory) · [免费音源总览](https://www.orchestraltools.com/free-virtual-instruments)

### 7. IK Multimedia SampleTank 4 CS

- 类型：免费 SampleTank 插件和独立程序。
- 覆盖：4 GB 以上、50 件基础乐器，包含常用键盘、吉他/贝斯、鼓、弦乐、铜管、合成器等方向。
- 优点：一套就能快速横向试听多种大类，最接近“现代大厂版小型通用音源包”。
- 限制：适合个人开发、制作和对照，不默认拥有把底层采样嵌入网页的权利。
- 官方：[SampleTank 4 CS](https://www.ikmultimedia.com/products/st4/)

### 8. Splice INSTRUMENT（原 Spitfire LABS 的新宿主）

- 类型：免费独立程序/VST3/AU/AAX 采样器。
- 覆盖：免费层约 500 个 presets，包含原 LABS/Spitfire 内容；钢琴、弦乐、吉他、鼓、打击乐、实验质感与氛围音色尤其丰富。
- 优点：Spitfire 团队制作的高质量、带性格的音色很多；免费层和定期 Free Drops 可长期使用。
- 注意：2025 年后旧 LABS 已迁移到 Splice INSTRUMENT，网上很多旧教程的安装方式已过时；免费内容和订阅内容要分清。仍按宿主音源使用，不抽取采样打包进网页。
- 官方：[Splice INSTRUMENT](https://splice.com/instrument) · [免费层说明](https://support.splice.com/en/articles/12270038-splice-instrument-plans-and-pricing)

### 9. ProjectSAM The Free Orchestra 2

- 类型：可在免费 Kontakt Player 中运行的电影管弦乐精选库。
- 覆盖：偏管弦乐合奏、节奏型、打击与 cinematic patches，不是完整 GM。
- 优点：ProjectSAM 是成熟的影视配乐音源厂牌，适合做“即刻有戏剧效果”的质量标杆。
- 限制：需要 Native Access/Kontakt Player；适合创作和参考，不用于网页采样再分发。
- 官方：[The Free Orchestra 2 安装说明](https://projectsam.com/getting-started/U05K7-B2UUC-4C6A4-44DBA-7DU6E%0D)

## 第一轮实际试听顺序

1. GeneralUser GS：验证网页中多乐器切换、加载时间和手机内存。
2. VSCO 2 CE：挑 2–3 个管弦乐器，验证自建小型网页采样包的工作量。
3. Komplete Start：快速建立跨乐器类别的质量参考。
4. SINEfactory：补高质量原声乐器和管弦乐参考。
5. SampleTank 4 CS：补流行/乐队类通用音色参考。
6. Splice INSTRUMENT：补有性格的钢琴、氛围、实验和质感音色。

最终接入任何第三方音色前，都应在仓库里为每个资产记录：下载版本、原始 URL、作者、授权全文、是否允许再分发、是否需要署名，以及音频文件的校验值。
