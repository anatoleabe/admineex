angular.module('app').controller('AdjustAllocationModalCtrl', ['$scope', '$http', 'toastr', '$mdDialog', 'allocation', 'instanceShareAmount', 'gettextCatalog',
    function ($scope, $http, toastr, $mdDialog, allocation, instanceShareAmount, gettextCatalog) {
        function t(msgid) {
            return gettextCatalog.getString(msgid);
        }
        function computeIsSansPart(data) {
            if (!data) return false;
            if (data.isSansPart === true) return true;
            if (data.isWithParts === false) return true;
            if (data.isWithParts === true) return false;
            return !!(data.templateId && data.templateId.category === 'without_parts');
        }

        // Get shareAmount - prioritize passed instanceShareAmount from wizard
        function getShareAmount(allocation, passedShareAmount) {
            // 1. From passed instanceShareAmount (from wizard scope)
            if (passedShareAmount && passedShareAmount > 0) {
                return passedShareAmount;
            }
            // 2. From populated instanceId object
            if (allocation.instanceId && typeof allocation.instanceId === 'object' && allocation.instanceId.shareAmount) {
                return allocation.instanceId.shareAmount;
            }
            // 3. From instance directly on allocation (older pattern)
            if (allocation.shareAmount) {
                return allocation.shareAmount;
            }
            // 4. From template calculationConfig defaultShareAmount
            if (allocation.templateId && allocation.templateId.calculationConfig && allocation.templateId.calculationConfig.defaultShareAmount) {
                return allocation.templateId.calculationConfig.defaultShareAmount;
            }
            return 0;
        }

        // Initialize the form data
        var isSansPart = computeIsSansPart(allocation);
        var isWithParts = !isSansPart;
        var shareAmount = getShareAmount(allocation, instanceShareAmount);
        console.log('[AdjustAllocationModal] instanceShareAmount=', instanceShareAmount, 'resolved shareAmount=', shareAmount, 'allocation=', allocation);

        $scope.selectedAllocation = {
            _id: allocation._id,
            personnelId: allocation.personnelId,
            status: allocation.status,
            calculatedAmount: allocation.calculatedAmount || 0,
            finalAmount: allocation.finalAmount || allocation.calculatedAmount || 0,
            calculationInputs: {
                parts: (allocation.calculationInputs && allocation.calculationInputs.parts) || allocation.parts || 0,
                comment: (allocation.calculationInputs && allocation.calculationInputs.comment) || '',
                // expose sans-part fields for display
                txPercent: allocation.calculationInputs && allocation.calculationInputs.txPercent,
                sbi: allocation.calculationInputs && allocation.calculationInputs.sbi,
                subType: allocation.calculationInputs && allocation.calculationInputs.subType
            },
            shareAmount: shareAmount,
            isSansPart: isSansPart,
            isWithParts: isWithParts
        };
        $scope.isWithParts = isWithParts;

        // Function to update final amount based on parts (only for with_parts)
        $scope.updateFinalAmount = function () {
            if ($scope.selectedAllocation.isSansPart) return; // not applicable
            var parts = $scope.selectedAllocation.calculationInputs.parts || 0;
            var shareAmt = $scope.selectedAllocation.shareAmount || 0;
            $scope.selectedAllocation.finalAmount = Math.round(parts * shareAmt);
            console.log('[AdjustAllocationModal] Recalculated: parts=', parts, 'shareAmount=', shareAmt, 'finalAmount=', $scope.selectedAllocation.finalAmount);
        };

        // Also watch for parts changes as a fallback (in case ng-change doesn't fire)
        $scope.$watch('selectedAllocation.calculationInputs.parts', function (newVal, oldVal) {
            if (newVal !== oldVal && $scope.isWithParts) {
                $scope.updateFinalAmount();
            }
        });

        // Load allocation history
        $scope.loadHistory = function () {
            $http.get('/api/bonus/allocations/' + allocation._id + '/history')
                .then(function (response) {
                    $scope.allocationHistory = response.data.history; // Updated to use the history array
                    $scope.currentAllocation = response.data.current; // Added to store the current allocation
                })
                .catch(function (error) {
                    console.error('Error fetching allocation history', error);
                    toastr.error(t('Could not fetch allocation history'));
                    $scope.allocationHistory = [];
                });
        };

        // Save the adjusted allocation
        $scope.save = function () {
            if (!$scope.selectedAllocation.calculationInputs.comment) {
                toastr.error(t('Adjustment reason is required'));
                return;
            }

            $scope.adjusting = true;

            var fd = new FormData();
            fd.append('parts', $scope.selectedAllocation.calculationInputs.parts);
            fd.append('amount', $scope.selectedAllocation.finalAmount);
            fd.append('reason', $scope.selectedAllocation.calculationInputs.comment);

            $http.post('/api/bonus/allocations/' + allocation._id + '/adjust', fd, {
                headers: { 'Content-Type': undefined }
            })
                .then(function (response) {
                    $scope.adjusting = false;
                    $mdDialog.hide(response.data);
                })
                .catch(function (error) {
                    console.error('Error adjusting allocation', error);
                    toastr.error((error.data && error.data.message) || t('Could not adjust allocation'));
                    $scope.adjusting = false;
                });
        };

        // Cancel the modal
        $scope.cancel = function () {
            $mdDialog.cancel();
        };

        // Load history when controller initializes
        $scope.loadHistory();
    }]);
