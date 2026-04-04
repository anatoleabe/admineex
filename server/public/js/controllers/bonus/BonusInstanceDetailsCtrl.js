/**
 * Bonus Instance Details Controller
 * Displays comprehensive details for a bonus instance including:
 * - Instance metadata and status
 * - Template configuration
 * - Allocation summary and list
 * - Timeline/history
 * - Quick actions
 */
angular.module('app')
    .controller('BonusInstanceDetailsCtrl', ['$scope', '$rootScope', '$http', '$stateParams', '$state', 'SweetAlert', 'toastr', '$timeout', 'gettextCatalog',
        function ($scope, $rootScope, $http, $stateParams, $state, SweetAlert, toastr, $timeout, gettextCatalog) {
            function t(msgid) {
                return gettextCatalog.getString(msgid);
            }

            function showConfirmDialog(config, onConfirm) {
                if (window.Swal && typeof window.Swal.fire === 'function') {
                    window.Swal.fire({
                        title: config.title,
                        text: config.text,
                        icon: config.icon || 'warning',
                        showCancelButton: true,
                        confirmButtonColor: config.confirmButtonColor || '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: config.confirmButtonText || t('Confirm'),
                        cancelButtonText: t('Cancel')
                    }).then(function (result) {
                        if (result && result.isConfirmed) {
                            onConfirm();
                        }
                    });
                    return;
                }

                if (SweetAlert && typeof SweetAlert.swal === 'function') {
                    try {
                        SweetAlert.swal({
                            title: config.title,
                            text: config.text,
                            type: config.icon || 'warning',
                            showCancelButton: true,
                            confirmButtonColor: config.confirmButtonColor || '#d33',
                            cancelButtonColor: '#3085d6',
                            confirmButtonText: config.confirmButtonText || t('Confirm'),
                            cancelButtonText: t('Cancel')
                        }, function (confirmed) {
                            if (confirmed) {
                                onConfirm();
                            }
                        });
                        return;
                    } catch (e) {
                    }
                }

                if (window.confirm(config.text)) {
                    onConfirm();
                }
            }

            // Initialize
            $scope.loading = true;
            $scope.instance = null;
            $scope.allocations = [];
            $scope.allocationStats = {};
            $scope.permissions = {};

            // Status configuration
            var statusConfig = {
                draft: { label: t('Draft'), icon: 'icon-pencil', color: 'secondary', description: t('Instance is being prepared') },
                pending_generation: { label: t('Pending Generation'), icon: 'icon-spinner11', color: 'info', description: t('Waiting for bonus calculation') },
                generated: { label: t('Generated'), icon: 'icon-checkmark-circle', color: 'primary', description: t('Bonuses calculated and ready for review') },
                under_review: { label: t('Under Review'), icon: 'icon-eye', color: 'warning', description: t('Being reviewed by bonus manager') },
                approved: { label: t('Approved'), icon: 'icon-checkmark2', color: 'success', description: t('Approved and ready for payment') },
                paid: { label: t('Paid'), icon: 'icon-coin-dollar', color: 'dark', description: t('Payment files generated') },
                cancelled: { label: t('Cancelled'), icon: 'icon-blocked', color: 'danger', description: t('Instance was cancelled') }
            };

            var periodicityLabels = {
                daily: t('Daily'),
                weekly: t('Weekly'),
                monthly: t('Monthly'),
                quarterly: t('Quarterly'),
                semesterly: t('Semesterly'),
                yearly: t('Yearly'),
                on_demand: t('On Demand')
            };

            $scope.getStatusConfig = function (status) {
                return statusConfig[status] || { label: status, icon: 'icon-question', color: 'secondary', description: '' };
            };

            $scope.getPeriodicityLabel = function (periodicity) {
                return periodicityLabels[periodicity] || periodicity;
            };

            // Load permissions
            $http.get('/api/bonus/config/permissions').then(function (response) {
                $scope.permissions = response.data;
            }).catch(function (err) {
                console.error('Error loading permissions', err);
            });

            // Load instance details
            function loadInstance() {
                var instanceId = $stateParams.instanceId;
                if (!instanceId) {
                    toastr.error(t('Invalid instance ID'));
                    $state.go('home.bonus.instances');
                    return;
                }

                $scope.loading = true;

                $http.get('/api/bonus/instances/' + instanceId)
                    .then(function (response) {
                        $scope.instance = response.data;
                        loadAllocationStats(instanceId);
                        loadAllocations(instanceId);
                    })
                    .catch(function (error) {
                        console.error('Error loading instance:', error);
                        toastr.error(t('Failed to load instance details'));
                        $state.go('home.bonus.instances');
                    })
                    .finally(function () {
                        $scope.loading = false;
                    });
            }

            // Load allocation statistics
            function loadAllocationStats(instanceId) {
                $http.get('/api/bonus/instances/' + instanceId + '/allocations/stats')
                    .then(function (response) {
                        $scope.allocationStats = response.data;
                    })
                    .catch(function (error) {
                        console.error('Error loading allocation stats:', error);
                    });
            }

            // Load allocations (first page)
            function loadAllocations(instanceId) {
                $http.get('/api/bonus/allocations', {
                    params: {
                        instanceId: instanceId,
                        limit: 10,
                        skip: 0
                    }
                })
                    .then(function (response) {
                        $scope.allocations = response.data.data || response.data || [];
                    })
                    .catch(function (error) {
                        console.error('Error loading allocations:', error);
                    });
            }

            // Format date
            $scope.formatDate = function (date) {
                if (!date) return '-';
                return new Date(date).toLocaleDateString();
            };

            // Format amount
            $scope.formatAmount = function (amount) {
                if (amount === null || amount === undefined) return '0';
                return Number(amount).toLocaleString();
            };

            // Actions
            $scope.goBack = function () {
                $state.go('home.bonus.instances');
            };

            $scope.openWizard = function () {
                if (!$scope.permissions.canManageCycle) {
                    toastr.error(t('Not authorized'));
                    return;
                }
                $state.go('home.bonus.instance.wizard', { instanceId: $scope.instance._id });
            };

            $scope.approve = function () {
                if (!$scope.permissions.canApproveInstance) {
                    toastr.error(t('Not authorized'));
                    return;
                }

                showConfirmDialog({
                    title: t('Approve Instance?'),
                    text: t('This will approve the bonus instance for payment.'),
                    icon: 'warning',
                    confirmButtonColor: '#28a745',
                    confirmButtonText: t('Yes, Approve')
                }, function () {
                    $http.post('/api/bonus/instances/' + $scope.instance._id + '/approve')
                        .then(function (response) {
                            toastr.success(t('Instance approved successfully'));
                            $scope.instance = response.data;
                        })
                        .catch(function (error) {
                            var msg = (error.data && error.data.message) || t('Failed to approve instance');
                            toastr.error(msg);
                        });
                });
            };

            $scope.generatePayments = function () {
                if (!$scope.permissions.canGeneratePayments) {
                    toastr.error(t('Not authorized'));
                    return;
                }

                showConfirmDialog({
                    title: t('Generate Payment Files?'),
                    text: t('This will generate payment files for the treasury.'),
                    icon: 'warning',
                    confirmButtonColor: '#28a745',
                    confirmButtonText: t('Yes, Generate')
                }, function () {
                    $http.post('/api/bonus/instances/' + $scope.instance._id + '/generate-payments')
                        .then(function (response) {
                            toastr.success(t('Payment files generated successfully'));
                            $scope.instance = response.data.instance;
                        })
                        .catch(function (error) {
                            var msg = (error.data && error.data.message) || t('Failed to generate payments');
                            toastr.error(msg);
                        });
                });
            };

            $scope.exportExcel = function () {
                if (!$scope.permissions.canExport) {
                    toastr.error(t('Not authorized'));
                    return;
                }
                window.location.href = '/api/bonus/instances/' + $scope.instance._id + '/export?format=excel';
            };

            $scope.exportPDF = function () {
                if (!$scope.permissions.canExport) {
                    toastr.error(t('Not authorized'));
                    return;
                }
                window.location.href = '/api/bonus/instances/' + $scope.instance._id + '/export?format=pdf';
            };

            $scope.cancelInstance = function () {
                if (!$scope.permissions.canCancelInstance) {
                    toastr.error(t('Not authorized'));
                    return;
                }

                showConfirmDialog({
                    title: t('Cancel Instance?'),
                    text: t('This will cancel the bonus instance. This action cannot be undone.'),
                    icon: 'warning',
                    confirmButtonColor: '#d33',
                    confirmButtonText: t('Yes, Cancel')
                }, function () {
                    $http.post('/api/bonus/instances/' + $scope.instance._id + '/cancel')
                        .then(function (response) {
                            toastr.success(t('Instance cancelled'));
                            $scope.instance = response.data;
                        })
                        .catch(function (error) {
                            var msg = (error.data && error.data.message) || t('Failed to cancel instance');
                            toastr.error(msg);
                        });
                });
            };

            $scope.deleteInstance = function () {
                if (!$scope.permissions.canDeleteInstance) {
                    toastr.error(t('Not authorized'));
                    return;
                }

                if ($scope.instance.status !== 'draft' && $scope.instance.status !== 'cancelled') {
                    toastr.error(t('Only draft or cancelled instances can be deleted'));
                    return;
                }

                showConfirmDialog({
                    title: t('Delete Instance?'),
                    text: t('This will permanently delete this bonus instance and all its allocations. This action cannot be undone.'),
                    icon: 'warning',
                    confirmButtonColor: '#d33',
                    confirmButtonText: t('Yes, Delete')
                }, function () {
                    $http.delete('/api/bonus/instances/' + $scope.instance._id)
                        .then(function () {
                            toastr.success(t('Instance deleted successfully'));
                            $state.go('home.bonus.instances');
                        })
                        .catch(function (error) {
                            var msg = (error.data && error.data.message) || t('Failed to delete instance');
                            toastr.error(msg);
                        });
                });
            };

            // Get timeline events for the instance
            $scope.getTimelineEvents = function () {
                if (!$scope.instance) return [];

                var events = [];

                if ($scope.instance.createdAt) {
                    events.push({
                        date: $scope.instance.createdAt,
                        label: t('Created'),
                        icon: 'icon-plus-circle2',
                        color: 'info'
                    });
                }

                if ($scope.instance.generationDate) {
                    events.push({
                        date: $scope.instance.generationDate,
                        label: t('Generated'),
                        icon: 'icon-cog',
                        color: 'primary'
                    });
                }

                if ($scope.instance.status === 'approved' && $scope.instance.approvalDate) {
                    events.push({
                        date: $scope.instance.approvalDate,
                        label: t('Approved'),
                        icon: 'icon-checkmark2',
                        color: 'success'
                    });
                }

                if ($scope.instance.status === 'paid' && $scope.instance.paymentDate) {
                    events.push({
                        date: $scope.instance.paymentDate,
                        label: t('Paid'),
                        icon: 'icon-coin-dollar',
                        color: 'dark'
                    });
                }

                // Sort by date
                events.sort(function (a, b) {
                    return new Date(a.date) - new Date(b.date);
                });

                return events;
            };

            // Initialize
            loadInstance();
        }]);
