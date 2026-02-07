// pages/admin/venue-manage.js
const util = require('../../utils/util.js')

Page({
  data: {
    venueList: [],
    loading: false
  },

  onLoad() {
    this.checkAdminPermission()
  },

  onShow() {
    this.loadVenueList()
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

    // 调试：打印用户角色信息
    console.log('=== 球馆管理权限检查 ===')
    console.log('实际角色 userRole:', app.globalData.userRole)
    console.log('显示角色 displayRole:', app.globalData.displayRole)
    console.log('userInfo.role:', userInfo ? userInfo.role : 'null')
    console.log('userInfo.currentRole:', userInfo ? userInfo.currentRole : 'null')

    // 管理员权限检查应该基于实际角色，而不是显示角色
    // 管理员可以切换显示角色，但仍然保持管理员权限
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

  // 加载球馆列表
  async loadVenueList() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageVenues',
        data: {
          action: 'list'
        }
      })

      if (res.result && res.result.success) {
        let venueList = res.result.data || []

        // 转换云存储文件ID为临时URL
        venueList = await this.convertImageUrls(venueList)

        this.setData({
          venueList: venueList
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

  // 转换云存储文件ID为临时URL
  async convertImageUrls(venueList) {
    if (!venueList || venueList.length === 0) {
      return venueList
    }

    try {
      // 使用统一的工具函数批量处理每个场馆的图片
      for (const venue of venueList) {
        // 处理 imageList 数组
        if (venue.imageList && venue.imageList.length > 0) {
          venue.imageList = await util.processCloudImageURLs(venue.imageList)
        }
        // 处理旧格式的 imageUrl
        if (venue.imageUrl && venue.imageUrl.startsWith('cloud://')) {
          venue.imageUrl = await util.processCloudImageURL(venue.imageUrl)
        }
      }
    } catch (err) {
      // 转换失败不影响显示，继续使用原fileID
    }

    return venueList
  },

  // 跳转到添加球馆页面
  goToAddVenue() {
    wx.navigateTo({
      url: '/pages/admin/venue-edit'
    })
  },

  // 跳转到编辑球馆页面
  goToEditVenue(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/venue-edit?id=${id}`
    })
  },

  // 删除球馆
  deleteVenue(e) {
    const { id, name } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定要删除球馆「${name}」吗？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('删除中...')

            const res = await wx.cloud.callFunction({
              name: 'manageVenues',
              data: {
                action: 'delete',
                venueId: id
              }
            })

            if (res.result.success) {
              util.showSuccess('删除成功')
              this.loadVenueList()
            } else {
              util.showError(res.result.message || '删除失败')
            }
          } catch (err) {
            util.showError('删除失败')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  },

  // 切换球馆状态
  async toggleStatus(e) {
    const { id, status, name } = e.currentTarget.dataset
    const newStatus = status === 1 ? 0 : 1
    const statusText = newStatus === 1 ? '启用' : '停用'

    wx.showModal({
      title: `确认${statusText}`,
      content: `确定要${statusText}球馆「${name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('提交中...')

            const res = await wx.cloud.callFunction({
              name: 'manageVenues',
              data: {
                action: 'update',
                venueId: id,
                venueData: {
                  status: newStatus
                }
              }
            })

            if (res.result.success) {
              util.showSuccess(`${statusText}成功`)
              this.loadVenueList()
            } else {
              util.showError(res.result.message || '操作失败')
            }
          } catch (err) {
            util.showError('操作失败')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  }
})
