// pages/admin/coach-manage/coach-select.js
const util = require('../../../../utils/util.js')

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

        this.setData({
          userList: userList
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
    this.setData({
      roleFilter: e.detail.value
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
  }
})
