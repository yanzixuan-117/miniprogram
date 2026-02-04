// pages/profile/edit.js
var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    newNickname: '',
    newAvatar: '',
    saving: false
  },

  onLoad: function(options) {
    // 检查登录状态
    if (!app.globalData.hasLogin || !app.globalData.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    var userInfo = app.globalData.userInfo
    this.setData({
      userInfo: userInfo,
      newNickname: userInfo.nickname || ''
    })
  },

  // 选择头像
  onChooseAvatar: function(e) {
    var avatarUrl = e.detail.avatarUrl
    this.setData({ newAvatar: avatarUrl })
  },

  // 输入昵称
  onNicknameInput: function(e) {
    this.setData({
      newNickname: e.detail.value
    })
  },

  // 保存
  handleSave: function() {
    var self = this
    var newNickname = self.data.newNickname
    var newAvatar = self.data.newAvatar
    var userInfo = self.data.userInfo

    // 验证昵称
    if (!newNickname || newNickname.trim().length < 2) {
      util.showToast('请输入昵称（至少2个字符）')
      return
    }

    if (newNickname.trim().length > 20) {
      util.showToast('昵称不能超过20个字符')
      return
    }

    self.setData({ saving: true })

    var avatarUrl = userInfo.avatarUrl

    // 如果选择了新头像，上传到云存储
    var uploadPromise = newAvatar ? self.uploadAvatar(newAvatar) : Promise.resolve(avatarUrl)

    uploadPromise.then(function(url) {
      if (newAvatar) {
        avatarUrl = url
      }

      return wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          nickname: newNickname.trim(),
          avatarUrl: avatarUrl
        }
      })
    }).then(async function(res) {
      if (res.result.success) {
        var updatedUser = res.result.data

        // 如果有云存储URL，立即转换为临时URL
        if (updatedUser.avatarUrl && updatedUser.avatarUrl.indexOf('cloud://') === 0) {
          try {
            var processedUrl = await util.processCloudImageURL(updatedUser.avatarUrl)
            updatedUser.avatarUrl = processedUrl
            updatedUser.cloudAvatarUrl = res.result.data.avatarUrl
          } catch (err) {
            // 忽略错误
          }
        }

        // 更新本地用户信息
        app.globalData.userInfo = updatedUser
        wx.setStorageSync({
          key: 'userInfo',
          data: updatedUser
        })

        util.showSuccess('保存成功')

        // 返回上一页
        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '保存失败')
      }
    }).catch(function(err) {
      util.showError('保存失败，请重试')
    }).then(function() {
      self.setData({ saving: false })
    })
  },

  // 上传头像到云存储
  uploadAvatar: function(tempFilePath) {
    return new Promise(function(resolve, reject) {
      var cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2, 11) + '.jpg'

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: function(res) {
          resolve(res.fileID)
        },
        fail: function(err) {
          reject(err)
        }
      })
    })
  }
})
