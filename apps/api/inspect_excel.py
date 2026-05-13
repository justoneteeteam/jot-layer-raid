import openpyxl

wb = openpyxl.load_workbook('../../NFL Database.xlsx')
sheet = wb.active
rows = list(sheet.iter_rows(values_only=True))
print("Headers:", rows[0])
for row in rows[1:6]:
    print(row)
