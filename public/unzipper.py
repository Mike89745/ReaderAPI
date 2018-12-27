import zipfile
import os
import argparse
class Unzipper:
    def Unzip(self,path):
        print(path)
        print(path.rsplit('/',1))
        with zipfile.ZipFile(path, 'r') as zip_ref:
            zip_ref.extractall(path.rsplit('/',1))
        os.remove(path)
        

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process zip to images", formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument('pathToData', nargs='+', help='Path to the zip')
    args = parser.parse_args()
    Unzipper = Unzipper()
    Unzipper.Unzip(args.pathToData[0])