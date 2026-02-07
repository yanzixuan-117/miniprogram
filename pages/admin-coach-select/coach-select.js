// pages/admin-coach-select/coach-select.js
const util = require('../../utils/util.js')

Page({
  data: {
    userList: [],
    loading: false,
    keyword: '',
    roleFilter: 'all' // all, student, coach
  },

  onLoad() {
    this.checkAdminPermission()
    this.loadUserList()
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()

    // 重新从 storage 加载用户信息以确保数据最新
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = userInfo
      app.globalData.userRole = userInfo.role
      app.globalData.displayRole = userInfo.currentRole || userInfo.role
      app.globalData.hasLogin = true
    }

    // 管理员权限检查应该基于实际角色，而不是显示角色
    const actualRole = app.globalData.userRole

    if (actualRole !== 'admin') {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问\n当前角色：' + (actualRole || '未登录'),
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return false
    }
    return true
  },

  // 加载用户列表
  async loadUserList() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'users'
        }
      })

      if (res.result.success) {
        let userList = res.result.data || []

        // 角色筛选
        if (this.data.roleFilter !== 'all') {
          userList = userList.filter(user => user.role === this.data.roleFilter)
        }

        // 关键词搜索筛选
        if (this.data.keyword && this.data.keyword.trim()) {
          const keyword = this.data.keyword.trim().toLowerCase()
          userList = userList.filter(user => {
            const nickname = (user.nickname || '').toLowerCase()
            return nickname.includes(keyword)
          })
        }

        // 格式化注册时间
        userList = userList.map(user => ({
          ...user,
          createTimeText: user.createTime ? util.formatDateCN(new Date(user.createTime)) : ''
        }))

        // 批量转换用户头像云存储URL为临时URL
        userList = await util.processListCloudURLs(userList, ['cloudAvatarUrl', 'avatarUrl'], '', true)

        this.setData({
          userList: userList
        })

        wx.showToast({
          title: `加载了${userList.length}个用户`,
          icon: 'none',
          duration: 2000
        })
      } else {
        util.showError(res.result.message || '加载失败')
      }
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  // 搜索
  onSearch() {
    this.loadUserList()
  },

  // 角色筛选
  onRoleFilterChange(e) {
    const roleMap = ['all', 'student', 'coach']
    this.setData({
      roleFilter: roleMap[e.detail.value]
    })
    this.loadUserList()
  },

  // 选择用户并添加为教练
  async selectUser(e) {
    const { openid, name, role } = e.currentTarget.dataset

    // 检查是否已经是教练
    if (role === 'coach') {
      util.showToast('该用户已经是教练')
      return
    }

    const confirm = await util.showConfirm(`确认将"${name}"添加为教练？`)

    if (!confirm) return

    util.showLoading('添加中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'add',
          userId: openid
        }
      })

      if (res.result.success) {
        util.showSuccess('添加成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '添加失败')
      }
    } catch (err) {
      util.showError('添加失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadUserList()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 图片加载失败处理
  onUserImageError(e) {
    const { url, name, index } = e.currentTarget.dataset

    wx.showModal({
      title: '头像加载失败',
      content: `用户：${name}\nURL前50字符：${url?.substring(0, 50) || '无'}...`,
      showCancel: false
    })
  }
})
