// app.js
App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-5gek6ubv254e3ab9", // 请填入你的云环境ID
      userInfo: null,
      hasLogin: false,
      userRole: null, // 'student' | 'coach' | 'admin' - 数据库中的实际角色，不随切换改变
      displayRole: null // 当前显示的角色，管理员可以切换
    };

    if (!wx.cloud) {
      wx.showToast({
        title: '请使用2.2.3或以上基础库',
        icon: 'none'
      });
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: false,
      });
    }

    // 检查用户登录状态
    this.checkLoginStatus();

    // 监听页面路由变化
    this.setupRouteMonitor();
  },

  // 设置页面路由监听
  setupRouteMonitor: function () {
    // 备用方案：重写页面的生命周期方法
    var originalPage = Page;
    Page = function(pageConfig) {
      var originalOnLoad = pageConfig.onLoad;
      var originalOnShow = pageConfig.onShow;
      var originalOnUnload = pageConfig.onUnload;
      var originalOnReady = pageConfig.onReady;

      // 重写 onLoad
      pageConfig.onLoad = function(query) {
        if (originalOnLoad) {
          return originalOnLoad.call(this, query);
        }
      };

      // 重写 onShow
      pageConfig.onShow = function() {
        if (originalOnShow) {
          return originalOnShow.call(this);
        }
      };

      // 重写 onUnload
      pageConfig.onUnload = function() {
        if (originalOnUnload) {
          return originalOnUnload.call(this);
        }
      };

      // 重写 onReady
      pageConfig.onReady = function() {
        if (originalOnReady) {
          return originalOnReady.call(this);
        }
      };

      return originalPage.call(this, pageConfig);
    };
  },

  // 检查登录状态
  checkLoginStatus: function () {
    var userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      // 检测并清理临时URL
      if (userInfo.avatarUrl && userInfo.avatarUrl.indexOf('?sign=') !== -1) {
        // avatarUrl是临时URL（已过期），清除cloudAvatarUrl字段
        // 这样前端会使用avatarUrl中的云存储URL（如果有）
        if (userInfo.cloudAvatarUrl) {
          userInfo.avatarUrl = userInfo.cloudAvatarUrl;
        }
      }

      this.globalData.userInfo = userInfo;
      this.globalData.hasLogin = true;
      this.globalData.userRole = userInfo.role; // 实际角色
      this.globalData.displayRole = userInfo.currentRole || userInfo.role; // 显示角色

      // 如果用户头像为云存储URL，尝试转换
      var cloudUrl = userInfo.cloudAvatarUrl || userInfo.avatarUrl;
      if (cloudUrl && cloudUrl.startsWith('cloud://')) {
        this.refreshUserAvatar(cloudUrl);
      }
    }
  },

  // 刷新用户头像（将云存储URL转换为临时URL）
  refreshUserAvatar: async function (cloudUrl) {
    var userInfo = this.globalData.userInfo;
    if (!userInfo) {
      return;
    }

    var util = require('./utils/util.js');

    try {
      // 使用统一的工具函数处理云存储URL
      var processedUrl = await util.processCloudImageURL(cloudUrl);
      userInfo.avatarUrl = processedUrl;
      userInfo.cloudAvatarUrl = cloudUrl;
      this.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
    } catch (err) {
      // 转换失败，保持原URL
    }
  },

  // 刷新用户头像（将云存储URL转换为临时URL）
  refreshUserAvatar: async function () {
    var userInfo = this.globalData.userInfo;
    if (!userInfo || !userInfo.avatarUrl) {
      return;
    }

    var util = require('./utils/util.js');

    try {
      // 使用统一的工具函数处理云存储URL
      var processedUrl = await util.processCloudImageURL(userInfo.avatarUrl);
      userInfo.avatarUrl = processedUrl;
      this.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
    } catch (err) {
      // 转换失败，保持原URL
    }
  },

  // 设置用户信息
  setUserInfo: function (userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.hasLogin = true;
    this.globalData.userRole = userInfo.role; // 实际角色，不随切换改变
    this.globalData.displayRole = userInfo.currentRole || userInfo.role; // 显示角色
    wx.setStorageSync('userInfo', userInfo);
  },

  // 清除用户信息
  clearUserInfo: function () {
    this.globalData.userInfo = null;
    this.globalData.hasLogin = false;
    this.globalData.userRole = null;
    this.globalData.displayRole = null;
    wx.removeStorageSync('userInfo');
  },

  // 检查权限
  hasRole: function (role) {
    return this.globalData.userRole === role;
  },

  // 是否是教练或管理员
  isCoachOrAdmin: function () {
    return this.globalData.userRole === 'coach' || this.globalData.userRole === 'admin';
  },

  // 是否是管理员
  isAdmin: function () {
    return this.globalData.userRole === 'admin';
  },

  // 切换管理员显示角色（仅管理员可用）
  switchAdminRole: function (role) {
    if (!this.isAdmin()) {
      return false;
    }

    var roles = ['student', 'coach', 'admin'];
    var isValid = false;
    for (var i = 0; i < roles.length; i++) {
      if (roles[i] === role) {
        isValid = true;
        break;
      }
    }

    if (isValid) {
      // 只修改显示角色，不修改实际角色
      this.globalData.displayRole = role;
      var userInfo = this.globalData.userInfo;
      if (userInfo) {
        userInfo.currentRole = role;
        wx.setStorageSync('userInfo', userInfo);
      }
      return true;
    }
    return false;
  },

  // ========== 统一的登录检查方法 ==========

  // 需要登录的页面列表
  requireLoginPages: [
    'pages/booking/confirm',       // 确认预约
    'pages/booking/manage',        // 预约管理
    'pages/video/manage',          // 视频管理
    'pages/video/upload',          // 视频上传
    'pages/video/favorites',       // 我的收藏
    'pages/session/create',        // 创建课程
    'pages/session/manage',        // 课程管理
    'pages/profile/edit',          // 编辑资料
  ],

  // 需要教练权限的页面列表
  requireCoachPages: [
    'pages/booking/manage',        // 预约管理
    'pages/session/create',        // 创建课程
    'pages/session/manage',        // 课程管理
  ],

  // 检查页面是否需要登录
  checkPageLogin: function (pagePath) {
    // 简化路径，去掉开头的 /
    var cleanPath = pagePath.replace(/^\//, '');

    // 检查是否在需要登录的页面列表中
    for (var i = 0; i < this.requireLoginPages.length; i++) {
      if (cleanPath.indexOf(this.requireLoginPages[i]) !== -1) {
        return true;
      }
    }
    return false;
  },

  // 检查页面是否需要教练权限
  checkPageCoach: function (pagePath) {
    var cleanPath = pagePath.replace(/^\//, '');
    for (var i = 0; i < this.requireCoachPages.length; i++) {
      if (cleanPath.indexOf(this.requireCoachPages[i]) !== -1) {
        return true;
      }
    }
    return false;
  },

  // 执行登录检查（在页面 onLoad 中调用）
  doLoginCheck: function (pagePath, options) {
    if (!options) {
      options = {};
    }
    var requireLogin = options.requireLogin || false;
    var requireCoach = options.requireCoach || false;

    // 检查是否登录
    if (requireLogin || this.checkPageLogin(pagePath)) {
      if (!this.globalData.hasLogin) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });

        setTimeout(function () {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }, 1500);

        return false;
      }
    }

    // 检查教练权限
    if (requireCoach || this.checkPageCoach(pagePath)) {
      if (!this.isCoachOrAdmin()) {
        wx.showToast({
          title: '需要教练权限',
          icon: 'none'
        });
        return false;
      }
    }

    return true;
  }
});
