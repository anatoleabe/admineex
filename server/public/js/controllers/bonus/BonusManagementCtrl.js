angular.module('app').controller('BonusManagementController', function ($scope, $http, $state, gettextCatalog, $filter) {
  $scope.title = gettextCatalog.getString('Bonus Management');

  $scope.stats = {
    totalPaid: 0,
    activeCyclesCount: 0,
    uniqueBeneficiaries: 0,
    currency: 'XAF'
  };

  $scope.recentActivity = [];

  // Charts Data
  $scope.trendsLabels = [];
  $scope.trendsData = [];
  $scope.trendsSeries = [gettextCatalog.getString('Total Payout')];

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

  // Load dashboard data
  function loadDashboardData() {
    var params = { status: getStatusParams() };

    // 1. Key Statistics
    $http.get('/api/bonus/dashboard/stats', { params: params }).then(function (response) {
      $scope.stats = response.data;
    });

    // 2. Trends Chart
    $http.get('/api/bonus/dashboard/trends', { params: params }).then(function (response) {
      $scope.trendsLabels = response.data.labels;
      $scope.trendsData = [response.data.data]; // Chart.js expects array of arrays for line charts
    });

    // 3. Distribution Chart
    $http.get('/api/bonus/dashboard/distribution', { params: params }).then(function (response) {
      $scope.distributionLabels = response.data.labels;
      $scope.distributionData = response.data.data;
    });

    // 4. Recent Activity
    $http.get('/api/bonus/dashboard/activity').then(function (response) {
      $scope.recentActivity = response.data;
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
