angular.module('app').controller('BonusManagementController', function ($scope, $http, $state, gettextCatalog, $filter) {
  $scope.title = gettextCatalog.getString('Bonus Management');

  $scope.stats = {
    totalPaid: 0,
    activeCyclesCount: 0,
    uniqueBeneficiaries: 0,
    currency: 'XAF'
  };

  $scope.recentActivity = [];

  // Date Range Filter
  var now = new Date();
  var twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  $scope.dateRange = {
    startDate: twelveMonthsAgo,
    endDate: now
  };

  // Predefined date range options
  $scope.dateRangeOptions = [
    { label: gettextCatalog.getString('Last 12 Months'), value: '12m' },
    { label: gettextCatalog.getString('Year to Date'), value: 'ytd' },
    { label: gettextCatalog.getString('Last 6 Months'), value: '6m' },
    { label: gettextCatalog.getString('Last 3 Months'), value: '3m' },
    { label: gettextCatalog.getString('This Quarter'), value: 'quarter' },
    { label: gettextCatalog.getString('Last Year'), value: 'lastyear' },
    { label: gettextCatalog.getString('All Time'), value: 'all' },
    { label: gettextCatalog.getString('Custom'), value: 'custom' }
  ];
  $scope.selectedDateRange = '12m';

  $scope.applyDateRange = function() {
    var now = new Date();
    var start, end = now;

    switch ($scope.selectedDateRange) {
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case '12m':
        start = new Date(now);
        start.setMonth(start.getMonth() - 12);
        break;
      case '6m':
        start = new Date(now);
        start.setMonth(start.getMonth() - 6);
        break;
      case '3m':
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      case 'quarter':
        var quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'lastyear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'all':
        start = new Date(2000, 0, 1); // Far past date
        break;
      case 'custom':
        // Use existing dateRange values
        return loadDashboardData();
      default:
        start = new Date(now.getFullYear(), 0, 1);
    }

    $scope.dateRange.startDate = start;
    $scope.dateRange.endDate = end;
    loadDashboardData();
  };

  // Charts Data
  $scope.trendsLabels = [];
  $scope.trendsData = [];
  $scope.trendsSeries = [gettextCatalog.getString('Total Disbursed')];

  $scope.distributionLabels = [];
  $scope.distributionData = [];

  function formatNumberWithSpaces(value) {
    if (value === null || value === undefined || value === '') return '';
    var numberValue = Number(value);
    if (!isFinite(numberValue)) return String(value);
    return numberValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatXaf(value) {
    try {
      return $filter('xaf')(value);
    } catch (e) {
      return formatNumberWithSpaces(value) + ' FCFA (XAF)';
    }
  }

  // Chart Options (shared defaults)
  $scope.chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: { display: true }
  };

  $scope.trendsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: { display: true },
    tooltips: {
      callbacks: {
        label: function (tooltipItem, data) {
          var datasetLabel = (data.datasets && data.datasets[tooltipItem.datasetIndex] && data.datasets[tooltipItem.datasetIndex].label) || '';
          var value = tooltipItem.yLabel;
          return (datasetLabel ? datasetLabel + ': ' : '') + formatXaf(value);
        }
      }
    },
    scales: {
      yAxes: [{
        ticks: {
          callback: function (value) {
            return formatNumberWithSpaces(value);
          }
        }
      }]
    }
  };

  $scope.distributionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: { display: true },
    // Disable the global "ratio center label" plugin for this doughnut chart
    centerText: false,
    tooltips: {
      callbacks: {
        label: function (tooltipItem, data) {
          var label = (data.labels && data.labels[tooltipItem.index]) ? data.labels[tooltipItem.index] : '';
          var value = (data.datasets && data.datasets[0] && data.datasets[0].data) ? data.datasets[0].data[tooltipItem.index] : null;
          return (label ? label + ': ' : '') + formatXaf(value);
        }
      }
    }
  };

  // Filters
  $scope.filterStatus = {
    approved: true,
    paid: true
  };

  // Toggle filter and reload
  $scope.toggleFilter = function () {
    loadDashboardData();
  };

  function getStatusParams() {
    var statuses = [];
    if ($scope.filterStatus.approved) statuses.push('approved');
    if ($scope.filterStatus.paid) statuses.push('paid');
    return statuses.join(',');
  }

  function formatDateParam(date) {
    if (!date) return '';
    var d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Load dashboard data
  function loadDashboardData() {
    var params = {
      status: getStatusParams(),
      startDate: formatDateParam($scope.dateRange.startDate),
      endDate: formatDateParam($scope.dateRange.endDate)
    };

    // 1. Key Statistics
    $http.get('/api/bonus/dashboard/stats', { params: params }).then(function (response) {
      $scope.stats = response.data;
    }).catch(function(err) {
      console.error('Error loading stats:', err);
    });

    // 2. Trends Chart
    $http.get('/api/bonus/dashboard/trends', { params: params }).then(function (response) {
      $scope.trendsLabels = response.data.labels;
      $scope.trendsData = [response.data.data]; // Chart.js expects array of arrays for line charts
    }).catch(function(err) {
      console.error('Error loading trends:', err);
    });

    // 3. Distribution Chart
    $http.get('/api/bonus/dashboard/distribution', { params: params }).then(function (response) {
      $scope.distributionLabels = response.data.labels;
      $scope.distributionData = response.data.data;
    }).catch(function(err) {
      console.error('Error loading distribution:', err);
    });

    // 4. Recent Activity
    $http.get('/api/bonus/dashboard/activity').then(function (response) {
      $scope.recentActivity = response.data;
    }).catch(function(err) {
      console.error('Error loading activity:', err);
    });
  }

  // Initialize the dashboard
  loadDashboardData();

  // Navigation helpers
  $scope.navigate = function (section) {
    if (section === 'new-campaign') {
      // Logic to open create wizard/modal
      // For now, redirect to instances with a flag or open a modal
      console.log("Open new campaign wizard");
    } else {
      $state.go('home.bonus.' + section);
    }
  };
});
