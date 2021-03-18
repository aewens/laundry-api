from datetime import datetime

def week_from_date(d):
    year, week, dow = d.isocalendar()
    return year, week

def date_from_week(week, year):
    # %G - 4 digit year corresponding to ISO-8601 week
    # %V - ISO-8601 week number (1-7)
    # %u - weekday number (1-7), 1 = Monday
    return datetime.strptime(f"{year}-{week}-1", "%G-%V-%u")
