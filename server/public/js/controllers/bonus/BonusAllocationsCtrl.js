angular.module('app').controller('BonusAllocationsController', ['$scope', '$http', 'toastr', '$uibModal', '$mdDialog', '$state', function($scope, $http, toastr, $uibModal, $mdDialog, $state) {
    $scope.allocations = [];
    $scope.loading = false;
    $scope.filters = {
        status: 'paid', // Default to 'paid' status
        instanceId: '',
        fromDate: '',
        toDate: ''
    };
    $scope.instances = [];
    $scope.pagination = {
        limit: 10,
        offset: 0,
        total: 0
    };

    // Status filter options
    $scope.statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'eligible', label: 'Eligible' },
        { value: 'excluded', label: 'Excluded' },
        { value: 'adjusted', label: 'Adjusted' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' },
        { value: 'cancelled', label: 'Cancelled' }
    ];

    // Load bonus instances for filter
    function loadInstances() {
        $http.get('/api/bonus/instances')
            .then(function(response) {
                $scope.instances = response.data.items || response.data;
            })
            .catch(function(error) {
                toastr.error('Failed to load bonus instances');
            });
    }

    // Pagination methods
    $scope.nextPage = function() {
        if (($scope.pagination.offset + $scope.pagination.limit) < $scope.pagination.total) {
            $scope.pagination.offset += $scope.pagination.limit;
            $scope.loadAllocations();
        }
    };

    $scope.prevPage = function() {
        if ($scope.pagination.offset > 0) {
            $scope.pagination.offset = Math.max(0, $scope.pagination.offset - $scope.pagination.limit);
            $scope.loadAllocations();
        }
    };

    // Format date for API
    function formatDate(date) {
        if (!date) return '';
        if (typeof date === 'string') {
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
            return new Date(date).toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    }

    // Load allocations with filters
    $scope.loadAllocations = function() {
        $scope.loading = true;
        let queryParams = {
            limit: $scope.pagination.limit,
            offset: $scope.pagination.offset
        };

        // Add filters if they are set
        if ($scope.filters.status) queryParams.status = $scope.filters.status;
        if ($scope.filters.instanceId) queryParams.instanceId = $scope.filters.instanceId;

        // Format dates for API
        if ($scope.filters.fromDate) queryParams.fromDate = formatDate($scope.filters.fromDate);
        if ($scope.filters.toDate) queryParams.toDate = formatDate($scope.filters.toDate);

        $http.get('/api/bonus/allocations', { params: queryParams })
            .then(function(response) {
                $scope.allocations = response.data;
                $scope.pagination.total = response.headers('X-Total-Count') || $scope.allocations.length;
                $scope.loading = false;
            })
            .catch(function(error) {
                toastr.error('Failed to load bonus allocations');
                console.error('Error loading allocations:', error);
                $scope.loading = false;
            });
    };

    // Apply filters
    $scope.applyFilters = function() {
        $scope.pagination.offset = 0;
        $scope.loadAllocations();
    };

    // Reset filters
    $scope.resetFilters = function() {
        $scope.filters = {
            status: 'paid', // Default to 'paid' status
            instanceId: '',
            fromDate: '',
            toDate: ''
        };
        $scope.pagination.offset = 0;
        $scope.loadAllocations();
    };

    // Initialize
    loadInstances();
    $scope.loadAllocations();
}]);
