// pages/fixed-booking/list.js
const util = require('../../utils/util.js')

Page({
  data: {
    fixedBookings: [],
    loading: false,
    coachMap: {},
    weekdayText: ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  },

  onLoad() {
    this.loadFixedBookings()
    this.loadCoachMap()
  },

  onShow() {
    this.loadFixedBookings()
  },

  // 加载固定预约列表
  async loadFixedBookings() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFixedBookings',
        data: {}
      })

      if (res.result.success) {
        this.setData({
          fixedBookings: res.result.data || []
        })
      } else {
        util.showError('加载失败')
      }
    } catch (err) {
      console.error('加载固定预约失败:', err)
      util.showError('加载失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载教练映射（用于显示教练名称）
  async loadCoachMap() {
    try {
      const res = await util.getList('coaches', {}, 100)
      const coaches = res.data || []
      const coachMap = {}
      coaches.forEach(coach => {
        coachMap[coach._id] = coach.name || coach.nickname
      })
      this.setData({ coachMap })
    } catch (err) {
      console.error('加载教练列表失败:', err)
    }
  },

  // 添加固定预约
  goToAdd() {
    wx.navigateTo({
      url: '/pages/fixed-booking/edit'
    })
  },

  // 编辑固定预约
  goToEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/fixed-booking/edit?id=${id}`
    })
  },

  // 暂停/启用固定预约
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 1 ? 0 : 1
    const action = newStatus === 1 ? '启用' : '暂停'

    const confirm = await util.showConfirm(`确定要${action}该固定预约吗？`)
    if (!confirm) return

    util.showLoading('处理中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'createFixedBooking',
        data: {
          action: 'updateStatus',
          bookingId: id,
          status: newStatus
        }
      })

      if (res.result.success) {
        util.showSuccess('操作成功')
        this.loadFixedBookings()
      } else {
        util.showError(res.result.message || '操作失败')
      }
    } catch (err) {
      console.error('操作失败:', err)
      util.showError('操作失败')
    } finally {
      util.hideLoading()
    }
  },

  // 删除固定预约
  async deleteBooking(e) {
    const { id, weekday, time } = e.currentTarget.dataset

    const confirm = await util.showConfirm(`确定删除每周${this.data.weekdayText[weekday]}${time}的固定预约吗？`)
    if (!confirm) return

    util.showLoading('删除中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'createFixedBooking',
        data: {
          action: 'delete',
          bookingId: id
        }
      })

      if (res.result.success) {
        util.showSuccess('删除成功')
        this.loadFixedBookings()
      } else {
        util.showError(res.result.message || '删除失败')
      }
    } catch (err) {
      console.error('删除失败:', err)
      util.showError('删除失败')
    } finally {
      util.hideLoading()
    }
  },

  // 手动触发预约（测试用）
  async triggerBookings() {
    util.showLoading('创建中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'autoCreateBookings',
        data: {}
      })

      if (res.result.success) {
        util.showSuccess(`成功创建 ${res.result.count || 0} 个预约`)
        wx.navigateTo({
          url: '/pages/booking/my-bookings'
        })
      } else {
        util.showError(res.result.message || '创建失败')
      }
    } catch (err) {
      console.error('创建预约失败:', err)
      util.showError('创建失败')
    } finally {
      util.hideLoading()
    }
  }
})
