// pages/booking/coach-list.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachList: [],
    filteredList: [],
    filters: {
      specialty: '',
      sortBy: 'default'
    },
    // 当前选中的筛选项和排序项名称
    specialtyName: '全部',
    sortName: '综合排序',

    specialtyOptions: [
      { value: '', label: '全部' },
      { value: '初学者', label: '初学者' },
      { value: '进阶技术', label: '进阶技术' },
      { value: '比赛战术', label: '比赛战术' }
    ],
    sortOptions: [
      { value: 'default', label: '综合排序' },
      { value: 'rating', label: '评分最高' }
    ],

    loading: false
  },

  onLoad: function() {
    this.loadCoachList()
  },

  // 加载教练列表
  loadCoachList: function() {
    var self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getCoaches',
      data: { status: 1 }
    }).then(function(res) {
      var coachList = res.result.success ? (res.result.data || []) : []

      self.setData({
        coachList: coachList,
        filteredList: coachList
      })
    }).catch(function(err) {
      util.showError('加载失败')
    }).then(function() {
      self.setData({ loading: false })
    })
  },

  // 显示筛选弹窗
  showFilter: function() {
    var self = this
    var itemList = self.data.specialtyOptions.map(function(item) { return item.label })
    wx.showActionSheet({
      itemList: itemList,
      success: function(res) {
        var selected = self.data.specialtyOptions[res.tapIndex]
        self.setData({
          'filters.specialty': selected.value,
          specialtyName: selected.label
        })
        self.applyFilters()
      }
    })
  },

  // 显示排序弹窗
  showSort: function() {
    var self = this
    var itemList = self.data.sortOptions.map(function(item) { return item.label })
    wx.showActionSheet({
      itemList: itemList,
      success: function(res) {
        var selected = self.data.sortOptions[res.tapIndex]
        self.setData({
          'filters.sortBy': selected.value,
          sortName: selected.label
        })
        self.applyFilters()
      }
    })
  },

  // 应用筛选和排序
  applyFilters: function() {
    var self = this
    var filteredList = []
    var i = 0

    // 手动复制数组
    for (i = 0; i < this.data.coachList.length; i++) {
      filteredList.push(this.data.coachList[i])
    }

    // 筛选
    if (this.data.filters.specialty) {
      filteredList = filteredList.filter(function(coach) {
        return coach.specialty && coach.specialty.indexOf(self.data.filters.specialty) !== -1
      })
    }

    // 排序
    switch (this.data.filters.sortBy) {
      case 'rating':
        filteredList.sort(function(a, b) { return (b.rating || 0) - (a.rating || 0) })
        break
      default:
        // 综合排序：按评分和评价数量
        filteredList.sort(function(a, b) {
          var scoreA = (a.rating || 0) * 10 + (a.reviewCount || 0)
          var scoreB = (b.rating || 0) * 10 + (b.reviewCount || 0)
          return scoreB - scoreA
        })
    }

    this.setData({ filteredList: filteredList })
  },

  // 查看教练详情
  viewCoachDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/coaches/detail?id=' + id
    })
  },

  // 立即预约
  bookNow: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/booking/select-date?coachId=' + id
    })
  },

  onPullDownRefresh: function() {
    this.loadCoachList()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 图片加载失败处理 - 尝试重新获取临时URL
  onImageError: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index
    var cloudUrl = e.currentTarget.dataset.cloudurl

    // 如果有云存储URL，尝试重新获取临时URL
    if (cloudUrl && cloudUrl.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [cloudUrl]
      }).then(function(res) {
        if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
          var tempUrl = res.fileList[0].tempFileURL
          var filteredList = self.data.filteredList
          filteredList[index].avatarUrl = tempUrl
          self.setData({ filteredList: filteredList })
        } else {
          // 获取失败，使用默认头像
          var filteredList = self.data.filteredList
          filteredList[index].avatarUrl = '/images/avatar.png'
          self.setData({ filteredList: filteredList })
        }
      }).catch(function(err) {
        console.error('重新获取临时URL失败:', err)
        // 失败时使用默认头像
        var filteredList = self.data.filteredList
        filteredList[index].avatarUrl = '/images/avatar.png'
        self.setData({ filteredList: filteredList })
      })
    } else {
      // 没有云存储URL，直接使用默认头像
      var filteredList = this.data.filteredList
      filteredList[index].avatarUrl = '/images/avatar.png'
      this.setData({ filteredList: filteredList })
    }
  }
})
