// pages/test/test.js
const util = require('../../utils/util.js')

Page({
  data: {
    envId: '',
    openid: '',
    hasOpenid: false,
    testing: false,
    logs: []
  },

  onLoad() {
    const app = getApp()
    this.setData({
      envId: app.globalData.env || '未配置'
    })

    this.addLog('info', '测试页面加载完成')
    this.addLog('info', '环境ID: ' + this.data.envId)

    // 检查云开发是否初始化
    if (wx.cloud) {
      this.addLog('success', '云开发 SDK 已加载')
    } else {
      this.addLog('error', '云开发 SDK 未加载，请使用基础库 2.2.3+')
    }
  },

  // 添加日志
  addLog(type, message, data) {
    const log = {
      type,
      time: new Date().toLocaleTimeString(),
      message,
      data: data ? JSON.stringify(data, null, 2) : ''
    }

    this.setData({
      logs: [...this.data.logs, log]
    })

  },

  // 测试云函数
  async testCloudFunction() {
    if (!this.checkEnv()) return

    this.setData({ testing: true })
    this.addLog('info', '开始测试云函数连接...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'test',
        data: {
          action: 'test',
          timestamp: Date.now()
        }
      })

      if (res.result.success) {
        this.addLog('success', '云函数调用成功！', res.result.data)

        if (res.result.data.openid) {
          this.setData({
            openid: res.result.data.openid,
            hasOpenid: true
          })
          this.addLog('success', '已获取 OpenID: ' + res.result.data.openid)
        }
      } else {
        this.addLog('error', '云函数返回错误: ' + res.result.message)
      }
    } catch (err) {
      this.addLog('error', '云函数调用失败', err)

      if (err.errMsg.includes('function not exist')) {
        this.addLog('info', '提示：请先部署 test 云函数')
      } else if (err.errMsg.includes('Environment not found')) {
        this.addLog('error', '云环境不存在或未配置，请检查 app.js 中的 env 参数')
      }
    } finally {
      this.setData({ testing: false })
    }
  },

  // 测试数据库查询
  async testDatabase() {
    this.setData({ testing: true })
    this.addLog('info', '开始测试数据库连接...')

    try {
      const db = wx.cloud.database()

      // 测试查询 users 集合
      const res = await db.collection('users').limit(10).get()

      this.addLog('success', `数据库查询成功，找到 ${res.data.length} 条记录`)

      if (res.data.length > 0) {
        this.addLog('info', '第一条数据:', res.data[0])
      } else {
        this.addLog('info', 'users 集合为空，请先登录创建用户')
      }
    } catch (err) {
      this.addLog('error', '数据库查询失败', err)

      if (err.errMsg.includes('collection not exist')) {
        this.addLog('error', '集合不存在，请先在控制台创建 users 集合')
      }
    } finally {
      this.setData({ testing: false })
    }
  },

  // 获取 OpenID
  async testGetOpenId() {
    this.setData({ testing: true })
    this.addLog('info', '开始获取用户 OpenID...')

    try {
      const res = await wx.cloud.getOpenId()

      this.setData({
        openid: res.openid,
        hasOpenid: true
      })

      this.addLog('success', 'OpenID 获取成功: ' + res.openid)
    } catch (err) {
      this.addLog('error', 'OpenID 获取失败', err)
    } finally {
      this.setData({ testing: false })
    }
  },

  // 创建测试数据
  async testCreateCollection() {
    if (!this.data.hasOpenid) {
      this.addLog('error', '请先获取 OpenID')
      return
    }

    this.setData({ testing: true })
    this.addLog('info', '开始创建测试数据...')

    try {
      const db = wx.cloud.database()

      const testData = {
        _openid: this.data.openid,
        nickname: '测试用户',
        type: 'test',
        createTime: new Date(),
        testField: '这是一个测试数据'
      }

      const res = await db.collection('users').add({
        data: testData
      })

      this.addLog('success', '测试数据创建成功！ID: ' + res._id)
    } catch (err) {
      this.addLog('error', '创建测试数据失败', err)
    } finally {
      this.setData({ testing: false })
    }
  },

  // 检查环境配置
  checkEnv() {
    const app = getApp()

    if (!app.globalData.env) {
      this.addLog('error', '环境ID未配置，请在 app.js 中填写 env 参数')
      wx.showModal({
        title: '环境未配置',
        content: '请先在 app.js 中配置云环境ID',
        showCancel: false
      })
      return false
    }

    return true
  },

  // 清空日志
  clearLogs() {
    this.setData({
      logs: []
    })
    this.addLog('info', '日志已清空')
  },

  // 返回首页
  goToHome() {
    this.addLog('info', '跳转到首页...')
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 直接登录
  goToLogin() {
    this.addLog('info', '跳转到登录页...')
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 检查当前用户信息
  async checkUserInfo() {
    this.addLog('info', '开始检查当前用户信息...')

    const app = getApp()
    const userInfo = wx.getStorageSync('userInfo')

    if (userInfo) {
      this.addLog('success', '本地存储中的用户信息:', userInfo)
      this.addLog('info', `昵称: ${userInfo.nickname}`)
      this.addLog('info', `角色: ${userInfo.role}`)
      this.addLog('info', `OpenID: ${userInfo._openid || '(未存储)'}`)
    } else {
      this.addLog('warn', '本地存储中没有用户信息')
    }

    // 检查 app.globalData
    this.addLog('info', 'globalData.hasLogin: ' + app.globalData.hasLogin)
    this.addLog('info', 'globalData.userRole: ' + app.globalData.userRole)
    if (app.globalData.userInfo) {
      this.addLog('info', 'globalData.userInfo.role: ' + app.globalData.userInfo.role)
    }

    // 尝试从数据库获取最新信息
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })

      if (res.result.success) {
        const dbUser = res.result.data
        this.addLog('success', '数据库中的用户信息:', dbUser)
        this.addLog('info', `数据库角色: ${dbUser.role}`)

        // 比对管理员配置
        const adminOpenids = ['o1oNQ3RuLrFzMlsU7rle03cyM3Pw']
        const isAdmin = adminOpenids.includes(dbUser._openid)
        this.addLog('info', `OpenID是否在管理员列表: ${isAdmin}`)
        this.addLog('info', `当前OpenID: ${dbUser._openid}`)
      }
    } catch (err) {
      this.addLog('error', '获取数据库信息失败', err)
    }
  },

  // 快速修复：更新角色为管理员
  async fixToAdmin() {
    this.addLog('info', '开始更新角色为管理员...')

    try {
      // 先调用登录云函数更新数据库
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          selectedRole: 'admin'  // 明确指定为 admin 角色
        }
      })

      if (res.result.success) {
        const userData = res.result.data
        this.addLog('success', '登录云函数返回角色: ' + userData.role)

        // 如果返回的还是 coach，直接更新数据库
        if (userData.role === 'coach') {
          this.addLog('warn', '云函数未正确更新角色，尝试直接更新数据库...')

          const db = wx.cloud.database()
          const userInfo = wx.getStorageSync('userInfo')

          // 直接更新数据库
          await db.collection('users').doc(userInfo._id).update({
            data: {
              role: 'admin'
            }
          })

          this.addLog('success', '数据库已直接更新为 admin')

          // 更新用户数据
          userData.role = 'admin'
          wx.setStorageSync('userInfo', userData)

          const app = getApp()
          app.globalData.userInfo = userData
          app.globalData.userRole = 'admin'

          this.addLog('success', '本地缓存已更新为 admin')
        } else {
          // 更新本地存储
          wx.setStorageSync('userInfo', userData)

          // 更新 app.globalData
          const app = getApp()
          app.globalData.userInfo = userData
          app.globalData.hasLogin = true
          app.globalData.userRole = userData.role

          this.addLog('success', '本地缓存已更新')
        }

        this.addLog('info', '请返回首页查看管理员功能区域')
      } else {
        this.addLog('error', '更新失败: ' + res.result.message)
      }
    } catch (err) {
      this.addLog('error', '更新失败', err)
    }
  }
})
