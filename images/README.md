# 图片资源说明

## 需要准备的图标

### TabBar 图标 (81x81px)

这些图标用于小程序底部导航栏，需要准备普通状态和激活状态两种版本。

#### 1. 首页图标
- `tab/home.png` - 未选中状态（灰色）
- `tab/home-active.png` - 选中状态（蓝色 #667eea）

建议：房子图标或首页图标

#### 2. 视频图标
- `tab/video.png` - 未选中状态（灰色）
- `tab/video-active.png` - 选中状态（蓝色 #667eea）

建议：播放按钮或摄像机图标

#### 3. 预约图标
- `tab/booking.png` - 未选中状态（灰色）
- `tab/booking-active.png` - 选中状态（蓝色 #667eea）

建议：日历或时钟图标

#### 4. 我的图标
- `tab/profile.png` - 未选中状态（灰色）
- `tab/profile-active.png` - 选中状态（蓝色 #667eea）

建议：用户头像或个人中心图标

### 应用图标

#### Logo
- `logo.png` - 应用Logo (建议尺寸: 200x200px)

建议：网球拍 + 运动元素的组合图标

#### 横幅背景（可选）
- `banner-bg.png` - 首页横幅背景 (建议尺寸: 750x600px)

## 图标设计建议

### 颜色规范
- 主色调：#667eea (紫蓝色)
- 次色调：#764ba2 (紫色)
- 普通状态：#999999 (灰色)
- 背景色：#ffffff (白色)

### 设计风格
- 简洁扁平化
- 线条清晰
- 易于识别
- 适合小程序尺寸

## 如何添加图标

### 方法一：直接放置
1. 将准备好的图标文件放入对应目录
2. 确保文件名与上述要求一致

### 方法二：使用在线图标库
推荐以下免费图标资源：
- [Iconfont](https://www.iconfont.cn/) - 阿里巴巴矢量图标库
- [Flaticon](https://www.flaticon.com/) - 扁平化图标库
- [IconPark](https://iconpark.oceanengine.com/) - 字节跳动图标库

### 方法三：使用占位图标（临时）
在开发阶段，可以使用文字或emoji作为占位符：
- 首页：🏠
- 视频：🎬
- 预约：📅
- 我的：👤

## 临时方案

如果暂时没有图标，可以修改 `app.json` 中的 TabBar 配置：

```json
"tabBar": {
  "color": "#666666",
  "selectedColor": "#2C7EF8",
  "backgroundColor": "#ffffff",
  "borderStyle": "black",
  "list": [
    {
      "pagePath": "pages/index/index",
      "text": "首页"
      // 暂时注释掉 iconPath 和 selectedIconPath
    },
    ...
  ]
}
```

这样底部导航栏就只显示文字，不显示图标。

---

**注意**：建议图标使用 PNG 格式，背景透明，尺寸正确。
