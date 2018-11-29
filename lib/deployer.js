/**
 * By Jacky Gu
 * 2018-11-20
 * 将hexo文件夹上传到IPFS网络
 */

const ipfsAPI = require('ipfs-api')
const fs = require('hexo-fs');
const gateway = "https://ipfs.infura.io/";
const deployIP = "ipfs.infura.io";
var hashArrar = [];
var elementRootHash = '';
var path = "";

module.exports = async (args)=>{
  if(args.type != 'ipfs'){
    return;
  }

  if (!args.host || !args.port || !args.protocol || !args.path) {
    console.log("args = " + args);
    console.log("[WARN] one of arguments [host,port,protocol,path] is null or undefined, not overriding with defaults");
    args.host = deployIP;
    args.port = "5001";
    args.protocol = "https";
    args.path = "public";
  }
  path = args.path;

  if(fs.statSync(args.path).isDirectory()){
    var ipfs = ipfsAPI(args.host, args.port, {protocol: args.protocol})
    //先上传素材
    var files = listDir(args.path, null, 0);
    await addFile(ipfs, files, 0);
  }else{
    return;
  }
}

function addFile(ipfs,files, flag){
  ipfs.files.add(files, (err, res) => {
    if(!err){
      if(flag == 0) {
        //上传素材
        res.forEach(function (re) {
            if (re.path == path) elementRootHash = re.hash;
            console.log("Uploaded: " + re.path + " => " + re.hash);
            var filename = re.path.substr(re.path.lastIndexOf("/") + 1)
            if (filename.indexOf(".") != -1) {
                //将素材hash值保存
                hashArrar.push({
                    filename: filename,
                    path: re.path.replace(path, ""),
                    hash: re.hash
                });
            }
        });
        //继续上传html文件
        files = listDir(path, null, 1);
        addFile(ipfs, files, 1);

      } else if(flag == 1) {
        //上传html文件
        res.forEach(function(re){
            console.log("Uploaded: " + re.path + " => " + re.hash);
            if (re.path == path) {
                console.log("========================================");
                console.log("Your web's IPFS hash is: " + re.hash);
                console.log("Url: " + gateway + "ipfs/" + re.hash);
                //publisIPNS(ipfs, re.hash);
            }
        })
      }
    }else{
      console.error(err);
    }
  })
}

function listDir(dir, filelist, flag) {
  //如果flag = 0, 则上传素材
  //如果flag = 1, 则上传html文件
  var path = path || require('path');
  var fs = fs || require('fs'),
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        //如果是目录
        filelist = listDir(path.join(dir, file), filelist, flag);
      } else {
        //如果是文件
        if((file.substr(-5).toLowerCase() == ".html" || file.substr(-4).toLowerCase() == ".htm") && flag == 1) {
            //如果是html，则替换素材为ipfs链接
            var html = fs.readFileSync(path.join(dir, file)).toString('utf-8');
            var html = replaceElement(html);
            var html = replaceBlock(html);

            var buffer = new Buffer(html, "utf-8");
            var content = {
                path: path.join(dir, file), // The file path
                content: buffer // A Buffer, Readable Stream or Pull Stream with the contents of the file
            }
            filelist.push(content);
        } else if(file.substr(-5).toLowerCase() != ".html" && file.substr(-4).toLowerCase() != ".htm" && flag == 0){
            //如果是非html，则先上传至ipfs
            var content = {
                path: path.join(dir, file), // The file path
                content: fs.readFileSync(path.join(dir, file)) // A Buffer, Readable Stream or Pull Stream with the contents of the file
            }
            filelist.push(content);
        }
      }
  });
  return filelist;
};

function replaceElement(str) {
    hashArrar.forEach(function(hash) {
        var pos = str.indexOf(hash.filename);
        if(pos > -1) {
            var start = str.lastIndexOf('"', pos) + 1;
            var end = str.indexOf('"', pos);
            var s = str.substring(start, end);
            var reg = new RegExp(s, "g");
            str = str.replace(reg, gateway + "ipfs/" + elementRootHash + hash.path);
        }
    })
    return str;
}

function replaceBlock(str) {
    //替换block数据块
    //****** */
    str = str.replace(new RegExp('href="/', "g"), 'href="');

    return str;
}

function publisIPNS(ipfs, addr) {
    //发布为ipns
    ipfs.name.publish("/ipfs/" + addr, function (err, res) {
        if(!err){
            console.log("IPNS: " + gateway + `ipns/${res.name}`)
        } else {
            console.error(err)
        }
    });
}