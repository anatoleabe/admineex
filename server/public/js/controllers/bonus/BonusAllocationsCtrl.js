angular.module('app').controller('BonusAllocationsController', ['$scope', '$http', 'toastr', '$uibModal', '$mdDialog', '$state', '$timeout', function($scope, $http, toastr, $uibModal, $mdDialog, $state, $timeout) {
    $scope.allocations = [];
    $scope.loading = false;
    $scope.searchTerm = '';
    $scope.filters = {
        status: 'all',
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
        { value: 'paid', label: 'Paid' },
        { value: 'cancelled', label: 'Cancelled' }
    ];

    // Load bonus instances for filter
    function loadInstances() {
        $http.get('/api/bonus/instances', { params: { limit: 100, offset: 0, sortBy: 'createdAt:desc' } })
            .then(function(response) {
                $scope.instances = response.data.items || response.data;
            })
            .catch(function() {
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
            offset: $scope.pagination.offset,
            envelope: true
        };

        // Add filters if they are set
        if ($scope.filters.status && $scope.filters.status !== 'all') queryParams.status = $scope.filters.status;
        if ($scope.filters.instanceId) queryParams.instanceId = $scope.filters.instanceId;

        // Format dates for API
        if ($scope.filters.fromDate) queryParams.fromDate = formatDate($scope.filters.fromDate);
        if ($scope.filters.toDate) queryParams.toDate = formatDate($scope.filters.toDate);

        // Add search term
        if ($scope.searchTerm && $scope.searchTerm.trim().length) queryParams.search = $scope.searchTerm.trim();

        $http.get('/api/bonus/allocations', { params: queryParams })
            .then(function(response) {
                const data = response.data;
                if (data && data.items) {
                    $scope.allocations = data.items;
                    $scope.pagination.total = data.total || data.items.length || 0;
                } else {
                    $scope.allocations = Array.isArray(data) ? data : [];
                    $scope.pagination.total = $scope.allocations.length;
                }
            })
            .catch(function(error) {
                toastr.error('Failed to load bonus allocations');
                console.error('Error loading allocations:', error);
            })
            .finally(function() {
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
        $scope.searchTerm = '';
        $scope.filters = {
            status: 'all',
            instanceId: '',
            fromDate: '',
            toDate: ''
        };
        $scope.pagination.offset = 0;
        $scope.loadAllocations();
    };

    // Debounce search input
    let searchDebounce;
    $scope.$watch('searchTerm', function(newVal, oldVal) {
        if (newVal === oldVal) return;
        if (searchDebounce) $timeout.cancel(searchDebounce);
        searchDebounce = $timeout(function() {
            $scope.pagination.offset = 0;
            $scope.loadAllocations();
        }, 300);
    });

    // Helper to display personnel
    $scope.getPersonnelDisplay = function(personnel) {
        if (!personnel) return 'N/A';
        try {
            if (personnel.name) {
                if (personnel.name.text) return personnel.name.text;
                if (personnel.name.use) return personnel.name.use;
                const family = Array.isArray(personnel.name.family) && personnel.name.family.length ? personnel.name.family[0] : '';
                const given = Array.isArray(personnel.name.given) && personnel.name.given.length ? personnel.name.given[0] : '';
                const combined = (family + ' ' + given).trim();
                if (combined) return combined;
            }
            return personnel.identifier || 'N/A';
        } catch (e) {
            return personnel.identifier || 'N/A';
        }
    };

    // Extra helpers for Sans-Part columns
    $scope.getTxPercent = function(allocation){
        var v = allocation && allocation.calculationInputs && allocation.calculationInputs.txPercent;
        if (v === 0 || v) return Math.round(Number(v));
        return '';
    };
    $scope.getSbi = function(allocation){
        var sbi = allocation && allocation.calculationInputs && allocation.calculationInputs.sbi;
        return Number(sbi || 0);
    };

    // Initialize
    loadInstances();
    $scope.loadAllocations();
}]);
