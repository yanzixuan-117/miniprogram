// pages/admin/coach-manage.js
const util = require('../../utils/util.js')

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

    // 重新从 storage 加载用户信息以确保数据最新
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = userInfo
      app.globalData.userRole = userInfo.role
      app.globalData.hasLogin = true
    }

    // 调试：打印用户角色信息
    console.log('=== 教练管理权限检查 ===')
    console.log('userRole:', app.globalData.userRole)
    console.log('userInfo.role:', userInfo ? userInfo.role : 'null')

    if (!app.isAdmin()) {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问\n当前角色：' + (app.globalData.userRole || '未登录'),
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
        let coachList = res.result.data || []

        // 按order排序
        coachList.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 999
          const orderB = b.order !== undefined ? b.order : 999
          return orderA - orderB
        })

        // 批量转换教练头像云存储URL为临时URL（统一使用 util 工具函数）
        coachList = await util.processListCloudURLs(coachList, ['cloudAvatarUrl', 'avatarUrl'], '', true)

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

  // 上移教练
  async moveUp(e) {
    const { index } = e.currentTarget.dataset
    const coachList = this.data.coachList

    if (index === 0) {
      wx.showToast({ title: '已经是第一个了', icon: 'none' })
      return
    }

    // 交换order值
    const currentCoach = coachList[index]
    const prevCoach = coachList[index - 1]
    const currentOrder = currentCoach.order !== undefined ? currentCoach.order : index
    const prevOrder = prevCoach.order !== undefined ? prevCoach.order : (index - 1)

    wx.showLoading({ title: '移动中...' })

    try {
      // 更新当前教练的order
      await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: currentCoach._id,
          coachData: {
            order: prevOrder
          }
        }
      })

      // 更新上一个教练的order
      await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: prevCoach._id,
          coachData: {
            order: currentOrder
          }
        }
      })

      wx.showToast({ title: '移动成功', icon: 'success' })
      this.loadCoachList()
    } catch (err) {
      wx.showToast({ title: '移动失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 下移教练
  async moveDown(e) {
    const { index } = e.currentTarget.dataset
    const coachList = this.data.coachList

    if (index === coachList.length - 1) {
      wx.showToast({ title: '已经是最后一个了', icon: 'none' })
      return
    }

    // 交换order值
    const currentCoach = coachList[index]
    const nextCoach = coachList[index + 1]
    const currentOrder = currentCoach.order !== undefined ? currentCoach.order : index
    const nextOrder = nextCoach.order !== undefined ? nextCoach.order : (index + 1)

    wx.showLoading({ title: '移动中...' })

    try {
      // 更新当前教练的order
      await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: currentCoach._id,
          coachData: {
            order: nextOrder
          }
        }
      })

      // 更新下一个教练的order
      await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: nextCoach._id,
          coachData: {
            order: currentOrder
          }
        }
      })

      wx.showToast({ title: '移动成功', icon: 'success' })
      this.loadCoachList()
    } catch (err) {
      wx.showToast({ title: '移动失败', icon: 'none' })
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

  // 图片加载失败处理 - 尝试重新获取临时URL
  onImageError(e) {
    const { index } = e.currentTarget.dataset
    const cloudUrl = e.currentTarget.dataset.cloudurl

    // 如果有云存储URL，尝试重新获取临时URL
    if (cloudUrl && cloudUrl.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [cloudUrl]
      }).then((res) => {
        if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
          const tempUrl = res.fileList[0].tempFileURL
          const coachList = [...this.data.coachList]
          coachList[index].avatarUrl = tempUrl
          this.setData({ coachList })
        } else {
          // 获取失败，使用默认头像
          const coachList = [...this.data.coachList]
          coachList[index].avatarUrl = ''
          this.setData({ coachList })
        }
      }).catch((err) => {
        console.error('重新获取临时URL失败:', err)
        // 失败时使用默认头像
        const coachList = [...this.data.coachList]
        coachList[index].avatarUrl = ''
        this.setData({ coachList })
      })
    } else {
      // 没有云存储URL，直接使用默认头像
      const coachList = [...this.data.coachList]
      coachList[index].avatarUrl = ''
      this.setData({ coachList })
    }
  }
})
