// pages/login/login.js
var util = require('../../utils/util.js')

Page({
  data: {
    hasLogin: false,
    userInfo: null,
    userAvatar: '',
    userNickname: '',
    loading: false,
    agreedToTerms: false
  },

  onLoad: function() {
    // 检查是否已登录
    var app = getApp()
    if (app.globalData.hasLogin) {
      this.setData({
        hasLogin: true,
        userInfo: app.globalData.userInfo
      })
    }
  },

  // 选择头像
  onChooseAvatar: function(e) {
    var avatarUrl = e.detail.avatarUrl
    this.setData({ userAvatar: avatarUrl })
  },

  // 输入昵称
  onNicknameInput: function(e) {
    this.setData({
      userNickname: e.detail.value
    })
  },

  // 切换协议同意状态
  toggleAgreement: function() {
    if (this.data.loading) return
    this.setData({
      agreedToTerms: !this.data.agreedToTerms
    })
  },

  // 查看用户协议
  viewUserAgreement: function() {
    wx.navigateTo({
      url: '/pages/agreement/user-agreement'
    })
  },

  // 查看隐私政策
  viewPrivacyPolicy: function() {
    wx.navigateTo({
      url: '/pages/agreement/privacy-policy'
    })
  },

  // 登录
  handleLogin: async function() {
    // 验证是否同意协议
    if (!this.data.agreedToTerms) {
      util.showToast('请先阅读并同意用户协议和隐私政策')
      return
    }

    // 验证输入
    if (!this.data.userAvatar) {
      util.showToast('请选择头像')
      return
    }

    if (!this.data.userNickname || this.data.userNickname.trim().length < 2) {
      util.showToast('请输入昵称（至少2个字符）')
      return
    }

    this.setData({ loading: true })

    try {
      // 上传头像到云存储
      var avatarUrl = await this.uploadAvatar(this.data.userAvatar)

      // 构造用户信息
      var userInfo = {
        nickName: this.data.userNickname.trim(),
        avatarUrl: avatarUrl
      }

      // 调用云函数登录
      await this.loginToCloud(userInfo)
    } catch (err) {
      util.showError('登录失败，请重试')
      this.setData({ loading: false })
    }
  },

  // 上传头像到云存储
  uploadAvatar: function(tempFilePath) {
    var self = this
    return new Promise(function(resolve, reject) {
      var cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).substring(2, 11) + '.jpg'

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: function(res) {
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve(res.fileID)
          } else {
            reject(new Error('上传失败，状态码：' + res.statusCode))
          }
        },
        fail: function(err) {
          reject(err)
        }
      })
    })
  },

  // 登录到云开发
  loginToCloud: function(userInfo) {
    var self = this
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'login',
        data: {
          userInfo: userInfo
        },
        success: async function(res) {
          console.log('=== 云函数返回结果 ===')
          console.log('完整返回:', res)
          console.log('result:', res.result)

          var result = res.result
          if (!result) {
            console.error('云函数返回为空')
            util.showError('登录失败，返回数据为空')
            self.setData({ loading: false })
            reject(new Error('返回数据为空'))
            return
          }

          console.log('success:', result.success)
          console.log('message:', result.message)
          console.log('data:', result.data)

          if (result.success) {
            // 保存用户信息
            var userData = result.data
            console.log('用户数据:', userData)

            // 如果有云存储URL，立即转换为临时URL
            if (userData.avatarUrl && userData.avatarUrl.indexOf('cloud://') === 0) {
              console.log('检测到云存储URL，开始转换...')
              try {
                var processedUrl = await util.processCloudImageURL(userData.avatarUrl)
                userData.avatarUrl = processedUrl
                console.log('URL转换成功:', processedUrl)
                // 确保cloudAvatarUrl字段存在（保存原始云存储URL）
                if (!userData.cloudAvatarUrl) {
                  userData.cloudAvatarUrl = result.data.avatarUrl
                }
              } catch (err) {
                console.error('URL转换失败:', err)
                // 转换失败时使用原始云存储URL
                if (!userData.cloudAvatarUrl) {
                  userData.cloudAvatarUrl = userData.avatarUrl
                }
              }
            } else if (!userData.cloudAvatarUrl) {
              // 如果avatarUrl不是云存储URL（可能是云函数已转换），确保有cloudAvatarUrl字段
              userData.cloudAvatarUrl = userData.avatarUrl || ''
            }

            console.log('最终用户数据:', userData)

            // 保存用户信息到 app 和 storage
            var app = getApp()
            app.globalData.userInfo = userData
            app.globalData.hasLogin = true
            app.globalData.userRole = userData.role
            wx.setStorageSync('userInfo', userData)

            console.log('保存用户信息成功，准备跳转')

            // 直接跳转首页
            self.redirectToHome()
            resolve()
          } else {
            console.error('登录失败:', result.message)
            util.showError(result.message || '登录失败')
            self.setData({ loading: false })
            reject(new Error(result.message))
          }
        },
        fail: function(err) {
          console.error('=== 云函数调用失败 ===')
          console.error('错误:', err)
          console.error('错误详情:', JSON.stringify(err))
          util.showError('登录失败，请重试')
          self.setData({ loading: false })
          reject(err)
        }
      })
    })
  },

  // 跳转到首页
  redirectToHome: function() {
    wx.switchTab({
      url: '/pages/index/index',
      fail: function() {
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }
    })
  }
})
