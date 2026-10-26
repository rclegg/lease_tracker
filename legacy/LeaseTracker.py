"""Command-line lease mileage calculator (the web page in ../web does the same thing).

Prints the miles per day you can still drive to stay within the lease allowance.
"""
import calendar
from datetime import date

# --- Lease terms: edit these for your lease ---
LEASE_START = date.fromisoformat('2021-02-13')
LEASE_TERM_MONTHS = 36
LEASE_MILES = 30000
ODOMETER_AT_START = 26


def add_months(start, months):
    """Return start plus whole months, clamped to the last day of a shorter month."""
    index = start.month - 1 + months
    year, month = start.year + index // 12, index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def main():
    odometer = float(input("Enter the current odometer reading: "))

    lease_end = add_months(LEASE_START, LEASE_TERM_MONTHS)
    lease_days = (lease_end - LEASE_START).days
    days_left = (lease_end - date.today()).days

    miles_per_day_at_start = LEASE_MILES / lease_days
    miles_remaining = LEASE_MILES + ODOMETER_AT_START - odometer

    print(f"When the lease began you could drive {miles_per_day_at_start:.2f} miles per day.")
    print(f"You now have {miles_remaining:.2f} miles remaining.")
    if days_left > 0:
        print(f"You can now drive at a pace of {miles_remaining / days_left:.2f} "
              f"miles per day for the remaining {days_left} days of the lease.")
    else:
        print(f"The lease ended on {lease_end}.")

    input("Press enter to exit.")


if __name__ == '__main__':
    main()
