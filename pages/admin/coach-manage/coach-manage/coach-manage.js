// pages/admin/coach-manage/coach-manage.js
const util = require('../../../../utils/util.js')

Page({
  data: {
    coachList: [],
    loading: false,
    keyword: ''
  },

  onLoad() {
    this.checkAdminPermission()
  },

  onShow() {
    this.loadCoachList()
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
      return false
    }
    return true
  },

  // 加载教练列表
  async loadCoachList() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'list'
        }
      })

      if (res.result && res.result.success) {
        const coachList = res.result.data || []
        this.setData({
          coachList: coachList
        })
      } else {
        util.showError(res.result?.message || '加载失败')
      }
    } catch (err) {
      util.showError('加载失败')
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
    const { coachList, keyword } = this.data
    if (!keyword) {
      this.loadCoachList()
      return
    }

    const filtered = coachList.filter(coach =>
      coach.name?.includes(keyword) ||
      coach.nickname?.includes(keyword)
    )

    this.setData({
      coachList: filtered
    })
  },

  // 跳转到添加教练页面（选择用户）
  goToAddCoach() {
    wx.navigateTo({
      url: '/pages/admin-coach-select/coach-select'
    })
  },

  // 跳转到编辑教练页面
  goToEditCoach(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin-coach-edit/coach-edit?id=${id}`
    })
  },

  // 删除教练
  async deleteCoach(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name

    const confirmRes = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `确认删除教练"${name}"？删除后该用户将失去教练权限。`,
        success: (res) => resolve(res.confirm)
      })
    })

    if (!confirmRes) return

    wx.showLoading({ title: '删除中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'delete',
          coachId: id
        }
      })

      if (res.result.success) {
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.loadCoachList()
      } else {
        wx.showToast({ title: res.result.message || '删除失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换教练状态
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 1 ? 0 : 1

    wx.showLoading({ title: '更新中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: id,
          coachData: {
            status: newStatus
          }
        }
      })

      if (res.result.success) {
        wx.showToast({ title: '更新成功', icon: 'success' })
        this.loadCoachList()
      } else {
        wx.showToast({ title: res.result.message || '更新失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadCoachList()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 图片加载失败处理
  onImageError(e) {
    const { index } = e.currentTarget.dataset
    // 使用默认头像替换加载失败的图片
    const coachList = [...this.data.coachList]
    coachList[index].avatarUrl = '/images/avatar.png'
    this.setData({ coachList })
  }
})
