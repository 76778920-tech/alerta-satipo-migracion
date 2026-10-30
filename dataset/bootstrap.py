from pathlib import Path
from dataset.adapters.http_csv import HttpCsvSource
from dataset.adapters.files import DatasetFiles
from dataset.application.prepare import PrepareDataset

URL = 'https://raw.githubusercontent.com/HamzaMa96/Smoke-Detection-IOT/main/smoke_detection_iot.csv'


def compose(root):
    root = Path(root)
    return PrepareDataset(HttpCsvSource(URL), DatasetFiles(root / 'data', root / 'data/seed.sql'))
