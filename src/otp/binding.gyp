{
  "targets": [
    {
      "target_name": "addon",
      "include_dirs": ['/usr/include'],
      "sources": [ "node_bridge.cpp", "eid.h", "eid.c"],
      "defines": [ "SERVER" ]
    }
  ]
}
