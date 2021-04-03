from datetime import timedelta, datetime, date

# Enter Current Odometer Reading
CurrentOdometerReading = round(float(input("Enter the current odometer reading: ")), 2)

# Lease Configuration
LeaseStartDate = date.fromisoformat('2021-02-13')
LeaseTotalMileage = 30000
LeaseTermInMonths = 36
OdometerReadingAtLeaseInception = 26

FinalMileageAllowed = LeaseTotalMileage + OdometerReadingAtLeaseInception
LeaseEndDate = LeaseStartDate + timedelta(weeks=((LeaseTermInMonths / 12) * 52))
MilesAllowedPerDay = LeaseTotalMileage / ((LeaseTermInMonths / 12) * 365.25)
today = datetime.today()
DaysRemaining = (LeaseEndDate - LeaseStartDate).days

RemainingMiles = FinalMileageAllowed - CurrentOdometerReading
RemainingMilesAllowedPerDay = RemainingMiles / DaysRemaining

print(f'''When the lease began you could drive {round(MilesAllowedPerDay, 2)} miles per day.
You now have {round(RemainingMiles, 2)} miles remaining. 
You can now drive at a pace of {round(RemainingMilesAllowedPerDay, 2)} \
miles per day for the remainder of the lease.''')

input("Press enter to exit.")
