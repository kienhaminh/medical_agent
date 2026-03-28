# Fix langchain 1.x incompatibility: langchain-core still references
# langchain.verbose which was removed in langchain 1.x.
import langchain
if not hasattr(langchain, "verbose"):
    langchain.verbose = False
