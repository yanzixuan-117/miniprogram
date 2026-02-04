// pages/admin/role-switch/role-switch.js
const util = require('../../../utils/util.js')

Page({
  data: {
    currentRole: 'admin',
    roleList: [
      {
        value: 'admin',
        name: '管理员',
        emoji: '🛡️',
        desc: '可以管理教练和切换角色'
      },
      {
        value: 'coach',
        name: '教练',
        emoji: '👨‍🏫',
        desc: '可以管理预约和上传视频'
      },
      {
        value: 'student',
        name: '学员',
        emoji: '🎾',
        desc: '可以预约课程和学习'
      }
    ]
  },

  onLoad() {
    this.checkAdminPermission()
    this.loadCurrentRole()
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()
    if (!app.isAdmin()) {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  // 加载当前角色
  loadCurrentRole() {
    const app = getApp()
    this.setData({
      currentRole: app.globalData.displayRole || app.globalData.userRole || 'admin'
    })
  },

  // 切换角色
  switchRole(e) {
    const role = e.currentTarget.dataset.role
    const roleInfo = this.data.roleList.find(r => r.value === role)

    if (role === this.data.currentRole) {
      util.showToast('当前已是该角色')
      return
    }

    wx.showModal({
      title: '确认切换',
      content: `确认切换到"${roleInfo.name}"角色？`,
      success: (res) => {
        if (res.confirm) {
          this.doSwitchRole(role)
        }
      }
    })
  },

  // 执行角色切换
  doSwitchRole(role) {
    const app = getApp()

    // 更新 app.js 中的角色
    const success = app.switchAdminRole(role)

    if (success) {
      util.showSuccess(`已切换到${this.data.roleList.find(r => r.value === role).name}角色`)
      this.setData({
        currentRole: role
      })

      // 延迟后返回首页刷新
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }, 1500)
    } else {
      util.showError('切换角色失败')
    }
  }
})
